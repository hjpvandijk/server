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
        // this.aggregateValues();
        // this.getBoxPlotArraysEvents(this.state.eventCounts, this.state.events);
        // this.getBoxPlotArraysStatistics();
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
            // this.aggregateValues();
            // this.getBoxPlotArraysEvents(this.state.eventCounts, this.state.events)
            // this.getBoxPlotArraysStatistics();
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
                console.log("eventCounts: ");
                console.log(jsonObj);
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
                console.log("Eventtimeline: ");
                console.log(jsonObj[0]);
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
                console.log("stats: ");
                console.log(jsonObj);
            });
    };

    // downloadStatisticsCSV(){
    //     let rows = [];
    //     const statisticNames = [];
    //     this.state.statistics[this.state.statistics.length - 1].forEach(element => {
    //         if(this.state.filters[element] == undefined){
    //             statisticNames.push(element);
    //         }
    //     });

    //     const eventNames = [];
    //     this.state.events.forEach(element => {
    //         if(this.state.filters[element] == undefined){
    //             eventNames.push(element);
    //         }
    //     });
    //     rows.push(["sessionID"].concat(statisticNames).concat(eventNames));

        
    //     let row = [];

    //     const valuePerStatistic = []
    //     const statisticValues = this.state.statistics[0][session.id];
    //     statisticNames.forEach(statistic => {
    //         if(this.state.filters[statistic] == undefined){

    //             var value = (statisticValues == undefined) ? 0 : ([statistic] == undefined ? 0 : statisticValues[statistic]);
    //             valuePerStatistic.push(
    //                 value
    //             );
    //         }
    //     });

    //     const countPerEvent = [];
    //     const eventCounts = this.state.eventCounts[session.id]
    //     eventNames.forEach(event => {
    //         if(this.state.filters[event] == undefined){

    //             countPerEvent.push(
    //                 (eventCounts == undefined) ? 0 : (eventCounts[event] == undefined ? 0 : eventCounts[event])
    //             );
    //         }
    //     });

    //     row.push([session.id].concat(valuePerStatistic).concat(countPerEvent));
        
    //     rows.push(row);
            

        


    //     // https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
    //     let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");

    //     var encodedUri = encodeURI(csvContent);
    //     var link = document.createElement("a");
    //     link.setAttribute("href", encodedUri);
    //     link.setAttribute("download", this.state.flightInfo.id+".csv");
    //     document.body.appendChild(link); // Required for FF

    //     link.click(); // This will download the data file named "my_data.csv".


    // }


    // aggregateValues(){
    //     const result = {};
    //     result["events"] = this.aggregateValuesParam(this.state.eventCounts, this.state.events);
    //     result["statistics"] = this.aggregateValuesParam(this.state.statistics[0], this.state.statistics[1]);
    //     return result;

    // };


    // aggregateValuesParam(dataPerSession, valueNames){
    //     const result = {};
    //     valueNames.forEach(valueName => {
    //         let total = 0;
    //         let totalAdds = 0;
    //         Object.values(this.state.sessionListing).forEach(session => {
    //             if (this.state.visualGroup == "All" || this.state.groupPerSession[session.id] == this.state.visualGroup){
    //                 if(dataPerSession[session.id] != undefined){
    //                     const val = dataPerSession[session.id][valueName];
    //                     if (typeof val ==  'number'){
    //                         total += val;
    //                     }
    //                 }
    //                 totalAdds++;
    //             }
    //         })
    //         result[valueName] = total/totalAdds;
    //     });
    //     return result;
    // };

    setGroup = (sessionID, group) => {
        if(group == ""){
            delete(this.state.groupPerSession[sessionID]);
        } else{
            this.state.groupPerSession[sessionID] = group;
        }

        this.forceUpdate();
    }

    getAllGroups(){
        const groups = [];  
        Object.keys(this.state.groupPerSession).forEach(sessionID => {
            var group = this.state.groupPerSession[sessionID];
            if(!groups.includes(group)){
                groups.push(group);
            }
        });
        if(groups.length == 0){
            this.state.visualGroup = "All";
        }
        return groups;
    }


    updateFilters(checked, label){
        if(checked){
            delete(this.state.filters[label]);
        }
        else {
            this.state.filters[label] = true;
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
                console.log("sc: ");
                console.log(jsonObj);
                
                for(var i=0; i<jsonObj.length; i++){
                    var fileName = jsonObj[i]['sessionID'];
                    console.log(fileName);
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
                            // screencapture: jsonObj[i]['bytes']
                        });
                        console.log("set screencapture");
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
                console.log("logs: ");
                console.log(jsonObj);
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
            console.log("null");
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
                // x: eventTimeline[event]["timestamps"],
                x: x,
                y: y,
                hovertext: sessions,
                customdata: groups,
                type: 'scatter',
                name: event,
                mode: 'lines+markers',
                // transforms: transforms
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
                    // color: 'rgba(17, 157, 255,0.5)',
                    opacity: 0.5,
                    symbol: 'line-ns-open',
                    size: 100,
                    line: {
                        // color: 'rgba(17, 157, 255,0.5)',
                        width: 10
                    },
                },
                hoverinfo: "x",
                transforms: transforms
            };
            eventTimelines.push(entry);
        });

        let boxTimeseriesLayout = {
            width: 800, height: 500
        };

        let eventTimelineLayout = {
            width: 800, height: 500, 
            yaxis: {
                range: [0, 1],
                showgrid: false,
                showline: false,
                showticklabels: false,
                zeroline: false,
              },
            xaxis: {
                showgrid: false,
                showline: false,
            },
            };


            let plots = boxPlots;
            let layout = boxTimeseriesLayout;
            if(visual == "Box Plots"){
                plots = boxPlots;
                layout = boxTimeseriesLayout;
            } else if(visual == "Time Series Plots"){
                plots = timeSeriesPlots;
                layout = boxTimeseriesLayout;
            } else if(visual == "Event Timeline"){
                plots = eventTimelines;
                layout = eventTimelineLayout;
            }

        // const groupselect = [];
        // this.getAllGroups().forEach(group =>{
        //     var groupOption = <option id={group} value={group}>{"Group " + group}</option>;
        //     groupselect.push(groupOption);
        // });

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
                {/* <span className="centre">
                    <span key={this.props.match.params.sessionid + log + "eventType"} className="title mono"> {log["eventType"]} </span>
                </span> 
                  
                <span className="centre">
                    <span key={this.props.match.params.sessionid + log + "eventDetails"} className="title mono"> {JSON.stringify(log["eventDetails"])} </span>
                </span>  */}

                <span className="centre">
                <span key={this.props.match.params.sessionid + log } className="title mono" onClick={() => this.setState({screencapturetime: log["timestamps"]["sinceScreenCaptureStartMillis"]/1000})}> {JSON.stringify(log)} </span>
                {/* <span key={this.props.match.params.sessionid + log } className="title mono" onMouseEnter={() => this.setState({screencapturetime: 3})}> {JSON.stringify(log)} </span> */}
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