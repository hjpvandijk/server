import io
import os
import sys
import traceback
import json
from typing import Dict
from django.core import signing
from django.http import StreamingHttpResponse
from ...control.models import Application, Flight
from .serializers import FlightSerializer, NewFlightSerializer
from mongo import get_mongo_connection_handle, get_mongo_collection_handle, get_mongo_collection_handle_gridfs
from ..dashboard.dwell_time import dwell_time
from ..dashboard.session_duration import session_duration
from ..dashboard.time_between_queries import time_between_queries

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
import base64
import pandas as pd
import math 

statisticMethods = [dwell_time, session_duration, time_between_queries]

class FlightInfo(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, appID=None):
        many = True

        if appID is None:
            return Response("", status=status.HTTP_400_BAD_REQUEST)
        
        try:
            application = Application.objects.get(id=appID)
        except Application.DoesNotExist:
            return Response("", status=status.HTTP_400_BAD_REQUEST)

        flights = Flight.objects.filter(application=application)

        serializer = FlightSerializer(flights, many=many)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SpecificFlightInfoView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    
    def get(self, request, flightID=None):
        if flightID is None:
            return Response("", status=status.HTTP_400_BAD_REQUEST)
        
        try:
            flight = Flight.objects.get(id=flightID)
        except Flight.DoesNotExist:
            return Response("", status=status.HTTP_400_BAD_REQUEST)
        
        serializer = FlightSerializer(flight, many=False)
        return Response(serializer.data, status=status.HTTP_200_OK)


class FlightAuthorisationTokenView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_authorisation_object(self, flight):
        return {
            'type': 'logUI-authorisation-object',
            'applicationID': str(flight.application.id),
            'flightID': str(flight.id),
        }

    def get(self, request, flightID=None):
        if flightID is None:
            return Response("", status=status.HTTP_400_BAD_REQUEST)

        try:
            flight = Flight.objects.get(id=flightID)
        except Flight.DoesNotExist:
            return Response("", status=status.HTTP_400_BAD_REQUEST)
        
        response_dict = {
            'flightID': str(flight.id),
            'flightAuthorisationToken': signing.dumps(self.get_authorisation_object(flight)),
        }
        
        return Response(response_dict, status=status.HTTP_200_OK)


class FlightStatusView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_flight_object(self, flightID):
        try:
            flight = Flight.objects.get(id=flightID)
            return flight
        except Flight.DoesNotExist:
            pass
        
        return False

    def get(self, request, flightID=None):
        flight = self.get_flight_object(flightID)

        if flight:
            return Response({'flightID': flightID, 'is_active': flight.is_active}, status=status.HTTP_200_OK)

        return Response({}, status=status.HTTP_404_NOT_FOUND)
    
    def patch(self, request, flightID=None):
        flight = self.get_flight_object(flightID)

        if flight:
            flight.is_active = not flight.is_active
            flight.save()

            return Response({'flightID': flightID, 'is_active': flight.is_active}, status=status.HTTP_200_OK)
        
        return Response({}, status=status.HTTP_404_NOT_FOUND)


class CheckFlightNameView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, appID):
        new_name = request.GET.get('flightName')
        response_dict = {
            'flightName': new_name,
            'is_available': True,
        }

        if new_name is None:
            return Response({}, status=status.HTTP_400_BAD_REQUEST)

        try:
            application = Application.objects.get(id=appID)
        except Application.DoesNotExist:
            return Response({}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            flight = Flight.objects.get(name__iexact=new_name, application=application)
            response_dict['is_available'] = False
        except Flight.DoesNotExist:
            pass
        
        return Response(response_dict, status=status.HTTP_200_OK)


class AddFlightView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, appID):
        if 'flightName' not in request.data or 'fqdn' not in request.data:
            return Response({}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            application = Application.objects.get(id=appID)
        except Application.DoesNotExist:
            return Response({}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            flight = Flight.objects.get(name__iexact=request.data['flightName'], application=application)
            return Response({}, status=status.HTTP_409_CONFLICT)
        except Flight.DoesNotExist:
            pass

        data = {}
        data['name'] = request.data['flightName']
        data['fqdn'] = request.data['fqdn']
        data['created_by'] = request.user.id
        data['application'] = application.id
        
        serializer = NewFlightSerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response({}, status=status.HTTP_201_CREATED)

        return Response({}, status=status.HTTP_201_CREATED)

class FlightLogDataDownloaderView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, flightID):

        try:
            flight = Flight.objects.get(id=flightID)
        except Flight.DoesNotExist:
            return Response({}, status=status.HTTP_404_NOT_FOUND)

        mongo_db_handle, mongo_connection = get_mongo_connection_handle()

        # Do we have a collection for the flight in the MongoDB instance?
        # If not, this means the flight has been created, but no data yet exists for it.
        if not str(flight.id) in mongo_db_handle.list_collection_names():
            return Response({}, status=status.HTTP_204_NO_CONTENT)
        
        # If we get here, then there is a collection -- and we can get the data for it.
        mongo_collection_handle = get_mongo_collection_handle(mongo_db_handle, str(flight.id))

        # Get all of the data.
        # This also omits the _id field that is added by MongoDB -- we don't need it.
        log_entries = mongo_collection_handle.find({}, {'_id': False})
        stream = io.StringIO()

        stream.write(f'[{os.linesep}{os.linesep}')
        
        # Get the count and if it matches the length...
        no_entries = log_entries.count()
        counter = 0

        for entry in log_entries:
            if counter == (no_entries - 1):
                stream.write(f'{json.dumps(entry)}{os.linesep}{os.linesep}')
                continue
            
            stream.write(f'{json.dumps(entry)},{os.linesep}{os.linesep}')
            counter += 1
        
        stream.write(f']')
        stream.seek(0)
        
        response = StreamingHttpResponse(stream, content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename=logui-{str(flight.id)}.log'
        
        mongo_connection.close()
        return response

class FlightScreenCapturesDownloaderView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, flightID):
        try:
            flight = Flight.objects.get(id=flightID)
        except Flight.DoesNotExist:
            return Response({}, status=status.HTTP_404_NOT_FOUND)
        mongo_db_handle, mongo_connection = get_mongo_connection_handle()

        # Do we have a collection for the flight in the MongoDB instance?
        # If not, this means the flight has been created, but no data yet exists for it.
        if not str(flight.id) in mongo_db_handle.list_collection_names():
            return Response({}, status=status.HTTP_204_NO_CONTENT)

        # If we get here, then there is a collection -- and we can get the data for it.
        mongo_collection_handle_gridfs = get_mongo_collection_handle_gridfs(mongo_db_handle, str(flight.id) + "_sc")
        # Get all of the data.
        # This also omits the _id field that is added by MongoDB -- we don't need it.
        log_entries = mongo_collection_handle_gridfs.find(no_cursor_timeout=True)
       
        stream = io.StringIO()

        stream.write(f'[{os.linesep}{os.linesep}')
        
        # Get the count and if it matches the length...
        no_entries = log_entries.count()
        counter = 0
        try:
            for entry in log_entries:
                print("id:", entry._id)
                # dict_str = entry.read().decode("UTF-8")
                # mydata = ast.literal_eval(dict_str)
                # print(dict_str)
                # print(mydata)
                encoded = base64.b64encode(entry.read())
                data = {}
                data['bytes'] = encoded.decode('ascii')
                data['sessionID'] = str(entry._id)
                dict_str = data

                if counter == (no_entries - 1):
                    stream.write(f'{json.dumps(dict_str)}{os.linesep}{os.linesep}')
                    continue
                stream.write(f'{json.dumps(dict_str)},{os.linesep}{os.linesep}')
                counter += 1
        except:
            print(sys.exc_info()[0])
            print(traceback.format_exc())
            return        
        
        stream.write(f']')
        stream.seek(0)
        
        response = StreamingHttpResponse(stream, content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename=logui-{str(flight.id)}.log'
        
        mongo_connection.close()
        return response

class FlightLogInteractionEventCounterView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, flightID):

        try:
            flight = Flight.objects.get(id=flightID)
        except Flight.DoesNotExist:
            return Response({}, status=status.HTTP_404_NOT_FOUND)

        mongo_db_handle, mongo_connection = get_mongo_connection_handle()

        # Do we have a collection for the flight in the MongoDB instance?
        # If not, this means the flight has been created, but no data yet exists for it.
        if not str(flight.id) in mongo_db_handle.list_collection_names():
            return Response({}, status=status.HTTP_204_NO_CONTENT)
        
        # If we get here, then there is a collection -- and we can get the data for it.
        mongo_collection_handle = get_mongo_collection_handle(mongo_db_handle, str(flight.id))

        # Get all of the data.
        # This also omits the _id field that is added by MongoDB -- we don't need it.
        log_entries = mongo_collection_handle.find({}, {'_id': False})
        stream = io.StringIO()

        stream.write(f'[{os.linesep}{os.linesep}')
        
        # Get the count and if it matches the length...
        # no_entries = log_entries.count()
        log_entries_list = list(log_entries)
        # print(log_entries_list)
        print("got entries")
        entries = {}
        try:
            # log_entries_json = json.loads(log_entries_list)
            df = pd.json_normalize(log_entries_list)
            unique = df['sessionID'].unique()
            all_values = []
            for i, id in enumerate(unique):
                if id is None:
                    continue
                session = df[ df['sessionID'] == id]
                # session = session[ session['eventType'] == 'interactionEvent']
                unique_vals = session['eventDetails.name'].unique()
                value_counts = session['eventDetails.name'].value_counts()
                # entry = {"sessionID": id, "value_counts": {}}
                entries[id] = {}
                for val in unique_vals:
                    if(not (isinstance(val, float) and math.isnan(val))):
                        if val not in all_values:
                            all_values.append(val)
                        count = value_counts.get(val)
                        entries[id][val] = int(count)
                # jsonObj = json.dumps(entry)

                # if i == unique.size - 1:
                #     stream.write(f'{json.dumps(entry)}{os.linesep}{os.linesep}')
                #     continue
                
            stream.write(f'{json.dumps(entries)},{os.linesep}{os.linesep}')
            stream.write(f'{json.dumps(all_values)}{os.linesep}{os.linesep}')

            stream.write(f']')
            stream.seek(0)

            response = StreamingHttpResponse(stream, content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename=logui-{str(flight.id)}.log'
            
            mongo_connection.close()
            return response
        except:
            print(sys.exc_info()[0])
            print(traceback.format_exc())
            return 

class FlightLogInteractionEventTimelineView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, flightID):

        try:
            flight = Flight.objects.get(id=flightID)
        except Flight.DoesNotExist:
            return Response({}, status=status.HTTP_404_NOT_FOUND)

        mongo_db_handle, mongo_connection = get_mongo_connection_handle()

        # Do we have a collection for the flight in the MongoDB instance?
        # If not, this means the flight has been created, but no data yet exists for it.
        if not str(flight.id) in mongo_db_handle.list_collection_names():
            return Response({}, status=status.HTTP_204_NO_CONTENT)
        
        # If we get here, then there is a collection -- and we can get the data for it.
        mongo_collection_handle = get_mongo_collection_handle(mongo_db_handle, str(flight.id))

        # Get all of the data.
        # This also omits the _id field that is added by MongoDB -- we don't need it.
        log_entries = mongo_collection_handle.find({}, {'_id': False})
        stream = io.StringIO()

        stream.write(f'[{os.linesep}{os.linesep}')
        
        # Get the count and if it matches the length...
        # no_entries = log_entries.count()
        log_entries_list = list(log_entries)
        # print(log_entries_list)
        print("got entries")
        entries = {}
        try:
            # log_entries_json = json.loads(log_entries_list)
            df = pd.json_normalize(log_entries_list)
            unique = df['eventDetails.name'].unique()
            for name in (unique):
                event = df[ df['eventDetails.name'] == name]
                sortedEvent = event.sort_values(by="timestamps.sinceSessionStartMillis")
                # sortedTime = sorted(event["timestamps.sinceSessionStartMillis"].to_numpy())
                sortedTime = sortedEvent["timestamps.sinceSessionStartMillis"].to_numpy()
                sortedIDs = sortedEvent["sessionID"].to_numpy()
                entries[name] = {}
                entries[name]["timestamps"] = [int(x) for x in sortedTime]
                entries[name]["sessionIDs"] = sortedIDs.tolist()

                
            stream.write(f'{json.dumps(entries)}{os.linesep}{os.linesep}')
            # stream.write(f'{json.dumps(all_values)}{os.linesep}{os.linesep}')

            stream.write(f']')
            stream.seek(0)

            response = StreamingHttpResponse(stream, content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename=logui-{str(flight.id)}.log'
            
            mongo_connection.close()
            return response
        except:
            print(sys.exc_info()[0])
            print(traceback.format_exc())
            return 

class FlightLogStatisticsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, flightID):

        try:
            flight = Flight.objects.get(id=flightID)
        except Flight.DoesNotExist:
            return Response({}, status=status.HTTP_404_NOT_FOUND)

        mongo_db_handle, mongo_connection = get_mongo_connection_handle()

        # Do we have a collection for the flight in the MongoDB instance?
        # If not, this means the flight has been created, but no data yet exists for it.
        if not str(flight.id) in mongo_db_handle.list_collection_names():
            return Response({}, status=status.HTTP_204_NO_CONTENT)
        
        # If we get here, then there is a collection -- and we can get the data for it.
        mongo_collection_handle = get_mongo_collection_handle(mongo_db_handle, str(flight.id))

        # Get all of the data.
        # This also omits the _id field that is added by MongoDB -- we don't need it.
        log_entries = mongo_collection_handle.find({}, {'_id': False})
        stream = io.StringIO()

        stream.write(f'[{os.linesep}{os.linesep}')
        
        # Get the count and if it matches the length...
        # no_entries = log_entries.count()
        log_entries_list = list(log_entries)
        # print(log_entries_list)
        print("got entries")
        entries = {}
        try:
            # log_entries_json = json.loads(log_entries_list)
            df = pd.json_normalize(log_entries_list)
            unique = df['sessionID'].unique()
            all_values = []
            for i, id in enumerate(unique):
                if id is None:
                    continue
                session = df[ df['sessionID'] == id]
                # session = session[ session['eventType'] == 'interactionEvent']
                entries[id] = {}
                for func in statisticMethods:
                    entry = func(session)
                    if isinstance(entry, dict) and "average" in entry.keys() and "total" in entry.keys():   #To do: make adaptive for all keys in dict
                        entries[id][func.__name__ + "_total"] = entry["total"]
                        entries[id][func.__name__ + "_average"] = entry["average"]
                        if i==0:
                            all_values.append(func.__name__ +  "_total")
                            all_values.append(func.__name__ +  "_average")
                    else:
                        entries[id][func.__name__] = entry
                        if i==0:
                            all_values.append(func.__name__)
            stream.write(f'{json.dumps(entries)},{os.linesep}{os.linesep}')
            stream.write(f'{json.dumps(all_values)}{os.linesep}{os.linesep}')

            stream.write(f']')
            stream.seek(0)

            response = StreamingHttpResponse(stream, content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename=logui-{str(flight.id)}.log'
            
            mongo_connection.close()
            return response
        except:
            print(sys.exc_info()[0])
            print(traceback.format_exc())
            return