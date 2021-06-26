import React from 'react';
import Menu from '../applications/menu';
import TrailItem from '../nav/trail/trailItem';
import Constants from '../constants';
import LogUIDevice from '../common/logUIDevice';
import {Link, Redirect} from 'react-router-dom';
import Plot from 'react-plotly.js';


class SessionDashboard extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            hasFailed: false,
            flightInfo: null,
            sessionListing: [],
            events: null,
            eventCounts: null,
            eventTimeline: null,
            valuesPerEvent: null,
            statistics: null,
            valuesPerStatistic: null,
            visual: 'Time Series Plots',
            groupPerSession: {},
            visualGroup: 'All',
            filters: {},
            screencapture: null,
            logs: null,
            screencapturetime: undefined
        };

        this.toggleFlightStatus = this.toggleFlightStatus.bind(this);
        this.loopvideo = this.loopvideo.bind(this);

    }

    getTrail() {
        if (this.state.hasFailed || !this.state.flightInfo) {
            return [];
        }

        return [
            <TrailItem key="1" to="/" displayText="LogUI" />,
            <TrailItem key="2" to="/applications" displayText="Applications" />,
            <TrailItem key="3" to={`/applications/${this.state.flightInfo.application.id}`} displayText={this.state.flightInfo.application.name} />,
            <TrailItem key="4" to={`/applications/${this.state.flightInfo.application.id}/${this.state.flightInfo.id}`} displayText={this.state.flightInfo.name} />,
            <TrailItem key="5" to={`/flight/${this.state.flightInfo.id}/dashboard`} displayText={this.state.flightInfo.name + " dashboard"} />,

        ];
    }

    async getFlightDetails() {
        var response = await fetch(`${Constants.SERVER_API_ROOT}flight/info/${this.props.match.params.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
        });

        await response.json().then(data => {
            if (response.status == 200) {
                this.setState({
                    flightInfo: data,
                });

                return;
            }

            this.setState({
                hasFailed: true,
            });
        });
    }

    async getSessionListings() {
        var response = await fetch(`${Constants.SERVER_API_ROOT}session/list/${this.props.match.params.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
        });

        await response.json().then(data => {
            this.setState({
                sessionListing: data,
            });
        });
    }

    async componentDidMount() {
        await this.getFlightDetails();
        await this.getSessionListings();
        await this.getEventCounts();
        await this.getStatistics();
        await this.getEventTimeline();
        await this.getScreenCapture();
        await this.getLogs();

        this.props.clientMethods.setMenuComponent(Menu);
        this.props.clientMethods.setTrailComponent(this.getTrail());
    }

    async componentDidUpdate(prevProps) {
        if (this.props.match.params.id !== prevProps.match.params.id) {
            await this.getFlightDetails();
            await this.getSessionListings();
            await this.getEventCounts();
            await this.getStatistics();
            await this.getEventTimeline();
            await this.getScreenCapture();
            await this.getLogs();

            this.props.clientMethods.setTrailComponent(this.getTrail());
        }
    }

    async toggleFlightStatus() {
        var response = await fetch(`${Constants.SERVER_API_ROOT}flight/info/${this.state.flightInfo.id}/status/`, {
            method: 'PATCH',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
        });

        await response.json().then(data => {
            let updatedFlightInfo = this.state.flightInfo;
            updatedFlightInfo.is_active = data.is_active;

            this.setState({
                flightInfo: updatedFlightInfo,
            });
        });
    }

    async getEventCounts() {
        var response = await fetch(`${Constants.SERVER_API_ROOT}flight/dashboard/eventcount/${this.state.flightInfo.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
            })
            .then(resp => resp.json())  // Take the json array that is returned by the server.
            .then(jsonObj => {
                let events = jsonObj[1];                              
                this.setState({
                    eventCounts: jsonObj[0][this.props.match.params.sessionid],
                    events: jsonObj[1]
                });
            });
    };

    async getEventTimeline() {
        var response = await fetch(`${Constants.SERVER_API_ROOT}flight/dashboard/eventTimeline/${this.state.flightInfo.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
            })
            .then(resp => resp.json())  // Take the json array that is returned by the server.
            .then(jsonObj => {             // Create a zipfile containing all screencaptures, named with their corresponding session id.                
                this.setState({
                    eventTimeline: jsonObj[0],
                });
            });
    };

    async getStatistics() {
        var response = await fetch(`${Constants.SERVER_API_ROOT}flight/dashboard/statistics/${this.state.flightInfo.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
            })
            .then(resp => resp.json())  // Take the json array that is returned by the server.
            .then(jsonObj => {       
                let statistics = jsonObj[0][this.props.match.params.sessionid];
                let statisticNames = jsonObj[1];
                let stats = [statistics, statisticNames];
                this.setState({
                    statistics: stats,
                });
            });
    };

    setGroup = (sessionID, group) => {
        if(group == ""){
            delete(this.state.groupPerSession[sessionID]);
        } else{
            this.state.groupPerSession[sessionID] = group;
        }

        this.forceUpdate();
    }

    async getScreenCapture() {
        var response = fetch(`${Constants.SERVER_API_ROOT}flight/download_sc/${this.props.match.params.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
            })
            .then(resp => resp.json())  // Take the json array that is returned by the server.
            .then(jsonObj => {             
                if (jsonObj.size == 0) {
                    alert('There is no log data available to download for this flight at present.');
                    return;
                }
                
                for(var i=0; i<jsonObj.length; i++){
                    var fileName = jsonObj[i]['sessionID'];
                    if(fileName == this.props.match.params.sessionid){
                        // From: https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
                        const byteCharacters = atob(jsonObj[i]['bytes']);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        let blob = new Blob([byteArray], { type: "video/webm" });



                        this.setState({
                            screencapture: URL.createObjectURL(blob)
                        });
                        return;
                    }

                }
                
            });
    };

    async getLogs() {
        var response = fetch(`${Constants.SERVER_API_ROOT}flight/download_one/${this.state.flightInfo.id}/${this.props.match.params.sessionid}`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
            })
            .then(resp => resp.json())  // Take the json array that is returned by the server
            .then(jsonObj => {            
                this.setState({
                    logs: jsonObj
                });
            });
    };

    loopvideo(event){
        const videoElem = event.target;
        if(this.state.screencapturetime != undefined && !isNaN(this.state.screencapturetime)){
            const lowTime = Math.max(this.state.screencapturetime - 2, 0);
            const highTime = this.state.screencapturetime + 2;
            if (videoElem.currentTime < lowTime || videoElem.currentTime >= highTime || videoElem.ended) {
                videoElem.currentTime = lowTime;
                videoElem.play();
            }
        } else{
            videoElem.pause();
            videoElem.currentTime=0;
        }
    }


    render() {
        
        


        if (this.state.hasFailed) {
            return(
                <Redirect to="/" />
            );
        }
        
        if (!this.state.flightInfo || !this.state.eventCounts || !this.state.statistics || !this.state.eventTimeline || !this.state.events ||!this.state.logs) {
            return(null); // Could add a loading thing here.
        }

        let sessionListing = this.state.sessionListing;
        let authToken = this.props.clientMethods.getLoginDetails().token;
        let events = this.state.events;
        let eventTimeline = this.state.eventTimeline;
        let eventCounts = this.state.eventCounts;
        let statistics = this.state.statistics;
        let valuesPerEvent = this.state.valuesPerEvent;
        let valuesPerStatistic = this.state.valuesPerStatistic;
        let visual = this.state.visual;
        let visualGroup = this.state.visualGroup;
        const setGroup = this.setGroup.bind(this);    
        let filters = this.state.filters;
        let flightInfo = this.state.flightInfo;
        let screencapture = this.state.screencapture;
        let loopvideo = this.loopvideo;
        let logs = this.state.logs;
        let thisSession = this.props.match.params.sessionid;

        
        const statisticNames = [];
        this.state.statistics[this.state.statistics.length - 1].forEach(element => {
            if(this.state.filters[element] == undefined){
                var el = <span className="double centre" >
                    <span key={element+"_title"} className="title analytics">{element}</span>
                    <span key={element+"_subtitle"} className="subtitle">statistic</span>
                </span>
                statisticNames.push(el)
            }
        });

        const eventNames = [];
        this.state.events.forEach(element => {
            if(this.state.filters[element] == undefined){
                var el = <span className="double centre" >
                    <span key={element+"_title"} className="title analytics">{element}</span>
                    <span key={element+"_subtitle"} className="subtitle">event</span>
                </span>
                eventNames.push(el)
            }
        });

        let transforms = 
        [{
            type: 'filter',
            target: 'hovertext',
            operation: '==',
            value: this.props.match.params.sessionid
          }];


        const timeSeriesPlots = [];
        events.forEach(event => {
            const y = [];
            const x = [];
            const sessions = [];
            var ct = 1;

            eventTimeline[event]["timestamps"].forEach(function(ts, i){
                if (eventTimeline[event]["sessionIDs"][i] == thisSession){
                    x.push(eventTimeline[event]["timestamps"][i]);
                    y.push(ct++);
                    sessions.push(thisSession);

                }
            });


            const groups = [];
            eventTimeline[event]["sessionIDs"].forEach(sessionID => {
                if(this.state.groupPerSession[sessionID] == undefined){
                    groups.push("");
                } else{
                    groups.push(this.state.groupPerSession[sessionID]);
                }
            });

            var entry = {
                x: x,
                y: y,
                hovertext: sessions,
                customdata: groups,
                type: 'scatter',
                name: event,
                mode: 'lines+markers',
            };
            timeSeriesPlots.push(entry);
        });

        const boxPlots = [];

        const eventTimelines = [];
        events.forEach(event => {
            const y = [];
            eventTimeline[event]["timestamps"].forEach(e => {
                y.push(0.5);
            });

            const groups = [];
            eventTimeline[event]["sessionIDs"].forEach(sessionID => {
                if(this.state.groupPerSession[sessionID] == undefined){
                    groups.push("");
                } else{
                    groups.push(this.state.groupPerSession[sessionID]);
                }
            });

            var entry = {
                x: eventTimeline[event]["timestamps"],
                y: y,
                hovertext: eventTimeline[event]["sessionIDs"],
                customdata: groups,
                name: event,
                type: 'scatter',
                mode: 'markers',
                marker: {
                    opacity: 0.5,
                    symbol: 'line-ns-open',
                    size: 100,
                    line: {
                        width: 10
                    },
                },
                hovertemplate:'<b>%{hovertext}</b>',
                transforms: transforms
            };
            eventTimelines.push(entry);
        });

        let boxTimeseriesLayout = { //Todo: add axis lables
            width: 1000, height: 500, 
            yaxis: {
                automargin: true,
            },
            xaxis: {
                automargin: true,
            }};

        let timeSeriesLayout = {//Todo: add axis lables
            width: 1000, height: 500, 
            yaxis: {
                automargin: true,
            },
            xaxis: {
                automargin: true,
            }};

        let eventTimelineLayout = {//Todo: add axis lables
            width: 1000, height: 500, 
            yaxis: {
                range: [0, 1],
                showgrid: false,
                showline: false,
                showticklabels: false,
                zeroline: false,
                automargin: true
              },
            xaxis: {
                text: "time since session start (ms)",
                showgrid: false,
                showline: false,
                automargin: true
            },
            };


            let plots = boxPlots;
            let layout = boxTimeseriesLayout;
            if(visual == "Box Plots"){
                plots = boxPlots;
                layout = boxTimeseriesLayout;
            } else if(visual == "Time Series Plots"){
                plots = timeSeriesPlots;
                layout = timeSeriesLayout;
            } else if(visual == "Event Timeline"){
                plots = eventTimelines;
                layout = eventTimelineLayout;
            }

        const filterEntries = [];
        statistics[1].forEach(stat => {
                filterEntries.push(
                    <div>
                        <input type="checkbox" className="checkbox" id={"checkbox_" + stat} name={"checkbox_" + stat}  defaultChecked onChange={(e) => this.updateFilters(e.target.checked, stat)}/>
                        <label htmlFor={"checkbox_" + stat}>{stat}</label>
                    </div>
                        
                );
        });
        events.forEach(event => {
                filterEntries.push(
                    <div>
                        <input type="checkbox" className="checkbox" id={"checkbox_" + event} name={"checkbox_" + event}  defaultChecked onChange={(e) => this.updateFilters(e.target.checked, event)}/>
                        <label htmlFor={"checkbox_" + event}>{event}</label>
                    </div>
                        
                );
        });


        
        const logEntries = [];
        logs.forEach(log => {
            logEntries.push(
            <div className="row double-height">

                <span className="centre">
                <span key={this.props.match.params.sessionid + log } className="title mono" onClick={() => this.setState({screencapturetime: log["timestamps"]["sinceScreenCaptureStartMillis"]/1000})}> {JSON.stringify(log)} </span>
                </span>   
                         
            </div>
            );
        });


      
        
        
        const valueEntries = [];
        

        statistics[1].forEach(stat => {
            if(this.state.filters[stat] == undefined){

                var value = (statistics[0] == undefined) ? 0 : (statistics[0][stat] == undefined ? 0 : statistics[0][stat]);

                valueEntries.push(
                    <span className="centre">
                        <span key={this.props.match.params.sessionid + stat} className="title mono"> {value} </span>
                    </span>
                    );
            }
        });

        events.forEach(event => {
            if(this.state.filters[event] == undefined){
                valueEntries.push(
                    <span className="centre">
                        <span key={this.props.match.params.sessionid + event} className="title mono"> {(eventCounts == undefined) ? 0 : (eventCounts[event] == undefined ? 0 : eventCounts[event])} </span>
                    </span>
                    );
            }
        });

        const videoElem = (screencapture != null) ? 
        <video width="450px" height="260px" id="screencapture" autoPlay controls muted onTimeUpdate={(event) => (loopvideo(event))}>
            <source src={screencapture} type="video/webm"></source>
        </video> 
        : "No screen capture was recorded for this session";

        return (
            

            <main>
                 
                <section>
                    <div className="header-container">
                        <h1>{"Session: " + this.props.match.params.sessionid}<span className="subtitle">{this.state.flightInfo.name}</span></h1>
                    </div>

                   


                    <div className="table aggregated" style={{'--totalEvents': events.length, '--totalStatistics': statistics[1].length, zoom: 0.8, MozTransformStyle: "scale(0.8)", MozTransformOrigin: '0 0'}}>
                            <div className="row header">
                                <div className="centre">
                                    <div></div>
                                </div>
                                {statisticNames}
                                {eventNames}
                            </div>
                            <div className="row double-height">
                                <div className="centre">
                                    <div></div>
                                </div>
                                {valueEntries}
                            </div>
                    </div>
                    
                    {/* <div className="filters">
                        <div>Filters</div>
                        {filterEntries}
                    </div> */}

                    <div className="videoDiv" width="450px" height="260px">  
                        {videoElem}
                    </div> 
                    
                    

                    <div className="plotDiv" style={{width: '800px', height: '500px'}}>
                        <div className="grupDropdown">
                            <select name="" onChange={(event) => (this.setState({visual: event.target.value}))}>
                                <option id="timeSeriesPlots" value="Time Series Plots">Time Series Plots</option>
                                <option id="eventTimeline" value="Event Timeline">Event Timeline</option>
                            </select>
                        </div>
                        <Plot
                                data={
                                plots
                                }
                                layout={ layout}
                                config={{responsive: true}}
                            />
                    </div>
                    
                    
                    <div className="table logs" style={{    zoom: 0.8, MozTransformStyle: "scale(0.8)", MozTransformOrigin: '0 0'}}>
                            <div className="row header">
                                <span className="centre" >
                                    <span key="logs" className="title">Logs</span>
                                </span>
                            </div>
                            {logEntries}
                    </div>
                   
                    

                </section>
            </main>
        );
    }


}


export default SessionDashboard;