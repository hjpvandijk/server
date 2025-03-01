from ...control.models import Application, Flight, Session
from mongo import get_mongo_connection_handle, get_mongo_collection_handle, get_mongo_collection_handle_gridfs

from channels.generic.websocket import WebsocketConsumer
from django.core.exceptions import ValidationError
from dateutil import parser as date_parser
from urllib.parse import urlparse
from django.core import signing
from datetime import datetime
import json
import base64
import sys
import traceback

SUPPORTED_CLIENTS = ['0.5.1', '0.5.2', '0.5.3']
KNOWN_REQUEST_TYPES = ['handshake', 'closedown', 'logEvents', 'screenCapture']
BAD_REQUEST_LIMIT = 3

class EndpointConsumer(WebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._handshake_success = False
        self._client_ip = None
        self._application = None
        self._flight = None
        self._session = None
        self._session_created = None
        self._mongo_db_handle, self._mongo_connection = get_mongo_connection_handle()
        self._mongo_collection = None

    def connect(self):
        self._client_ip = self.scope['client'][0]  # Is this the correct value?
        self.accept()

    # def receive_json(self, request_dict):
    #     if not self.validate_request(request_dict) or not self.validate_handshake(request_dict):
    #         return
        
    #     if request_dict['type'] == 'handshake':
    #         self.send_json(self.generate_message_object('handshakeSuccess', {
    #             'sessionID': str(self._session.id),
    #             'clientStartTimestamp': str(self._session.client_start_timestamp),
    #             'newSessionCreated': self._session_created,
    #         }))
    #         return
        
    #     type_redirection = {
    #         'logEvents': self.handle_log_events,
    #     }

    #     type_redirection[request_dict['type']](request_dict)

    def receive(self, text_data=None, bytes_data=None):
        request_dict = None
        if text_data:
            request_dict = json.loads(text_data)
        
            if not self.validate_request(request_dict) or not self.validate_handshake(request_dict):
                return
            
            if request_dict['type'] == 'handshake':
                self.send(json.dumps(self.generate_message_object('handshakeSuccess', {
                    'sessionID': str(self._session.id),
                    'clientStartTimestamp': str(self._session.client_start_timestamp),
                    'newSessionCreated': self._session_created,
                })))
                return
            
            type_redirection = {
                'logEvents': self.handle_log_events
            }

            type_redirection[request_dict['type']](request_dict)
        elif bytes_data:
            self.handle_screen_capture(bytes_data)
            return
    
    def disconnect(self, close_code):
        self._mongo_connection.close()
        pass
    
    def generate_message_object(self, message_type, payload):
        return {
            'sender': 'logUIServer',
            'type': message_type,
            'payload': payload,
        }
    
    def validate_request(self, request_dict):
        bad_request = False

        if 'sender' not in request_dict or request_dict['sender'] != 'logUIClient':
            bad_request = True
        
        if ('type' not in request_dict or request_dict['type'] not in KNOWN_REQUEST_TYPES) and not bad_request:
            bad_request = True
        
        if bad_request:
            self.close(code=4001)
            return False
        
        return True


    def validate_handshake(self, request_dict):
        if not self._handshake_success:
            if request_dict['type'] == 'handshake':
                print(request_dict)
                if ('clientVersion' not in request_dict['payload'] or
                    'authorisationToken' not in request_dict['payload'] or
                    'pageOrigin' not in request_dict['payload'] or
                    'userAgent' not in request_dict['payload'] or
                    'clientTimestamp' not in request_dict['payload']):
                    self.close(code=4002)
                    return False
                
                # Do we support the version of the client with this server?
                matching_version = False

                for permitted_version in SUPPORTED_CLIENTS:
                    if request_dict['payload']['clientVersion'].startswith(permitted_version):
                        matching_version = True
                        break
                
                if not matching_version:
                    self.close(code=4003)
                    return False

                try:
                    if not self.is_authorisation_valid(signing.loads(request_dict['payload']['authorisationToken']), request_dict['payload']['pageOrigin']):
                        return False
                except signing.BadSignature:
                    self.close(code=4004)
                    return False
                
                # Check the session ID is okay, if it exists.
                # If it doesn't, we create a new session.
                if not self.check_set_session(request_dict):
                    self.close(code=4006)
                    return False
                
                # Is the flight set to accept new clients?
                # If not, then we must reject the request.
                if not self._flight.is_active:
                    self.close(code=4007)
                    return False
                
                # If we get here intact, the handshake was a success.
                self._handshake_success = True
        
        return True
    
    def is_authorisation_valid(self, authorisation_object, page_origin):
        if ('type' not in authorisation_object or
            'applicationID' not in authorisation_object or
            'flightID' not in authorisation_object):
            self.close(code=4004)
            return False
        
        if authorisation_object['type'] != 'logUI-authorisation-object':
            self.close(code=4004)
            return False

        # Check the application exists. Set the instance variable.
        try:
            self._application = Application.objects.get(id=authorisation_object['applicationID'])
        except Application.DoesNotExist:
            self.close(code=4004)
            return False

        # Check the flight exists. Set the instance variable.
        try:
            self._flight = Flight.objects.get(id=authorisation_object['flightID'])
        except Flight.DoesNotExist:
            self.close(code=4004)
            return False

        # Check the domain matches the expected value. Set the instance variable.
        if self._flight.fqdn.lower() == 'bypass' or urlparse(self._flight.fqdn).netloc == 'localhost':
            return True
        else:
            split_origin = urlparse(page_origin)

            if self._flight.fqdn != split_origin.netloc:
                self.close(code=4005)
                return False

        return True
    
    def check_set_session(self, request_dict):
        user_agent = request_dict['payload']['userAgent']

        if 'sessionID' in request_dict['payload']:
            session_id = request_dict['payload']['sessionID']

            try:
                session = Session.objects.get(id=session_id)
            except Session.DoesNotExist:
                return False
            except ValidationError:
                return False
            
            # If flights do not match, we aren't using the same flight as originally started used.
            if session.flight != self._flight:
                return False
            
            # If the UA strings do not match, we aren't using the same browser as originally used.
            if session.ua_string != user_agent:
                return False
            
            self._session = session
            self._session_created = False
            return True
        
        # Create a new session object.
        session = Session()
        session.flight = self._flight
        session.ip_address = self._client_ip
        session.ua_string = user_agent
        session.client_start_timestamp = date_parser.parse(request_dict['payload']['clientTimestamp'])

        session.save()
        self._session = session
        self._session_created = True

        return True
    
    def handle_log_events(self, request_dict):
        if not self._session:
            self.close(code=4006)
            return
        

        for item in request_dict['payload']['items']:
            print(item)
            if item['eventType'] == 'statusEvent' and item['eventDetails']['type'] == 'stopped':
                self._session.client_end_timestamp = date_parser.parse(item['timestamps']['eventTimestamp'])
                self._session.server_end_timestamp = datetime.now()
                self._session.save()


            item['applicationID'] = str(self._application.id)
            item['flightID'] = str(self._flight.id)
            
            
            if not self._mongo_collection:
                self._mongo_collection = get_mongo_collection_handle(self._mongo_db_handle, str(self._flight.id))
            # print(item)
            self._mongo_collection.insert(item)

    def handle_screen_capture(self, binary_data):
        if not self._session:
            self.close(code=4006)
            return
        

        print("SCREEN CAPTURE")
        # print(item[ 'eventDetails']) 


        mongo_collection_sc_gridfs = get_mongo_collection_handle_gridfs(self._mongo_db_handle, str(self._flight.id) + "_sc")

        # mongo_collection_sc_gridfs.put(binary_data, _id=self._session.id)

        if(mongo_collection_sc_gridfs.exists(self._session.id)):
            try:
                entry = mongo_collection_sc_gridfs.get(self._session.id).read()
                # entry.extend(binary_data)
                entry += binary_data
                mongo_collection_sc_gridfs.delete(self._session.id)
                mongo_collection_sc_gridfs.put(entry, _id=self._session.id)
            except:
                print("Unexpected error:", sys.exc_info()[0])
                print(traceback.print_exc())
                return
            
        else:
            # binary_array = bytearray(binary_data)
            mongo_collection_sc_gridfs.put(binary_data, _id=self._session.id)
     

    # def handle_screen_capture(self, request_dict):
    #     if not self._session:
    #         self.close(code=4006)
    #         return
        
    #     import json

    #     item = request_dict['payload']['item']
    #     if item['eventType'] == 'screenCaptureEvent':
    #         print("SCREEN CAPTURE")
    #         # print(item[ 'eventDetails']) 


    #         item['applicationID'] = str(self._application.id)
    #         item['flightID'] = str(self._flight.id)
    #         # print(item['eventDetails']['chunk'])
        
    #         mongo_collection_sc_gridfs = get_mongo_collection_handle_gridfs(self._mongo_db_handle, str(self._flight.id) + "_sc")
    #         if(mongo_collection_sc_gridfs.exists(item['sessionID'])):
    #             entry = mongo_collection_sc_gridfs.get(item['sessionID'])
    #             entry_dict = json.loads(entry.read())
    #             try:
    #                 first_bytes = base64.b64decode(entry_dict['eventDetails']['chunk'].encode('ascii'))
    #                 first_string = first_bytes.decode("ascii").replace("\"",'').replace("data:video/webm;codecs=vp8;base64,", "")
    #                 print(first_string)
    #                 second_bytes = base64.b64decode(item['eventDetails']['chunk'].encode('ascii'))
    #                 second_string = second_bytes.decode("ascii")
    #                 combined_bytes = (first_string + second_string).encode('ascii').replace("\"",'').replace("data:video/webm;codecs=vp8;base64,", "")
    #                 combined_base64_bytes = base64.b64encode(combined_bytes)
    #                 combined_base64 = combined_bytes.decode('ascii')
    #                 entry_dict['eventDetails']['chunk'] = combined_base64
    #             except:
    #                 print("Unexpected error:", sys.exc_info()[0])
    #                 print(traceback.print_exc())
    #             mongo_collection_sc_gridfs.delete(item['sessionID'])
    #             mongo_collection_sc_gridfs.put(json.dumps(item).encode('utf-8'), _id=item['sessionID'])
    #         else:
    #             item['eventDetails']['chunk'].replace("\"",'').replace("data:video/webm;codecs=vp8;base64,", "")
    #             mongo_collection_sc_gridfs.put(json.dumps(item).encode('utf-8'), _id=item['sessionID'])
    #     else:
    #         print("Event type not of screenCaptureEvent")
