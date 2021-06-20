import React from 'react';
import Menu from '../applications/menu';
import TrailItem from '../nav/trail/trailItem';
import Constants from '../constants';
import LogUIDevice from '../common/logUIDevice';
import {Link, Redirect} from 'react-router-dom';
import Plot from 'react-plotly.js';

class FlightDashboard extends React.Component {

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
            visual: 'Box Plots',
            groupPerSession: {},
            visualGroup: 'All',
            filters: {}
        };

        this.toggleFlightStatus = this.toggleFlightStatus.bind(this);
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
        this.getBoxPlotArraysEvents(this.state.eventCounts, this.state.events);
        this.getBoxPlotArraysStatistics();
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
            this.getBoxPlotArraysEvents(this.state.eventCounts, this.state.events)
            this.getBoxPlotArraysStatistics();
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
            .then(jsonObj => {             // Create a zipfile containing all screencaptures, named with their corresponding session id.                
                this.setState({
                    eventCounts: jsonObj[0],
                    events: jsonObj[1]
                });
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
            .then(jsonObj => {             // Create a zipfile containing all screencaptures, named with their corresponding session id.                
                this.setState({
                    statistics: jsonObj,
                });
                console.log(jsonObj);
            });
    };


    downloadStatisticsCSV(e){
        e.preventDefault();

        let rows = [];
        const statisticNames = [];
        this.state.statistics[this.state.statistics.length - 1].forEach(element => {
            if(this.state.filters[element] == undefined){
                statisticNames.push(element);
            }
        });

        const eventNames = [];
        this.state.events.forEach(element => {
            if(this.state.filters[element] == undefined){
                eventNames.push(element);
            }
        });
        rows.push(["sessionID"].concat(statisticNames).concat(eventNames));

        Object.values(this.state.sessionListing).forEach(session => {
            let row = [];

            const valuePerStatistic = []
            const statisticValues = this.state.statistics[0][session.id];
            statisticNames.forEach(statistic => {
                if(this.state.filters[statistic] == undefined){

                    var value = (statisticValues == undefined) ? 0 : ([statistic] == undefined ? 0 : statisticValues[statistic]);
                    valuePerStatistic.push(
                        value
                    );
                }
            });

            const countPerEvent = [];
            const eventCounts = this.state.eventCounts[session.id]
            eventNames.forEach(event => {
                if(this.state.filters[event] == undefined){

                    countPerEvent.push(
                        (eventCounts == undefined) ? 0 : (eventCounts[event] == undefined ? 0 : eventCounts[event])
                    );
                }
            });

            row.push([session.id].concat(valuePerStatistic).concat(countPerEvent));
            
            rows.push(row);
            
        });

        


        // https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
        let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");

        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", this.state.flightInfo.id+".csv");
        document.body.appendChild(link); // Required for FF

        link.click(); // This will download the csv file.

        return false;
    }

    downloadAggregatedCSV(e){
        e.preventDefault();

        let rows = [];
        const statisticNames = [];
        this.state.statistics[this.state.statistics.length - 1].forEach(element => {
            if(this.state.filters[element] == undefined){
                statisticNames.push(element);
            }
        });

        const eventNames = [];
        this.state.events.forEach(element => {
            if(this.state.filters[element] == undefined){
                eventNames.push(element);
            }
        });
        rows.push(statisticNames.concat(eventNames));

        let aggregated = this.aggregateValues();
        
        const valuePerStatistic = []
        statisticNames.forEach(statistic => {
            if(this.state.filters[statistic] == undefined){

                valuePerStatistic.push(
                    aggregated["statistics"][statistic]
                );
            }
        });

        const countPerEvent = [];
        eventNames.forEach(event => {
            if(this.state.filters[event] == undefined){

                countPerEvent.push(
                    aggregated["events"][event]
                );
            }
        });
        let row = [];
        row.push(valuePerStatistic.concat(countPerEvent));
        
        rows.push(row);

        // https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
        let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");

        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", this.state.flightInfo.id+"_aggregated.csv");
        document.body.appendChild(link); // Required for FF

        link.click(); // This will download the csv file.

        return false;
    }

    aggregateValues(){
        const result = {};
        result["events"] = this.aggregateValuesParam(this.state.eventCounts, this.state.events);
        result["statistics"] = this.aggregateValuesParam(this.state.statistics[0], this.state.statistics[1]);
        return result;

    };


    aggregateValuesParam(dataPerSession, valueNames){
        const result = {};
        valueNames.forEach(valueName => {
            let total = 0;
            let totalAdds = 0;
            Object.values(this.state.sessionListing).forEach(session => {
                if (this.state.visualGroup == "All" || this.state.groupPerSession[session.id] == this.state.visualGroup){
                    if(dataPerSession[session.id] != undefined){
                        const val = dataPerSession[session.id][valueName];
                        if (typeof val ==  'number'){
                            total += val;
                        }
                    }
                    totalAdds++;
                }
            })
            result[valueName] = total/totalAdds;
        });
        return result;
    };

    getBoxPlotArraysStatistics(){
        const dataPerSession = this.state.statistics[0];
        const valueNames = this.state.statistics[1];
        const result = {};
        valueNames.forEach(valueName => {
            result[valueName] = {};
            result[valueName]["values"] = [];
            result[valueName]["sessionIDs"] = [];
            Object.values(this.state.sessionListing).forEach(session => {
                if(dataPerSession[session.id] != undefined){
                    const val = dataPerSession[session.id][valueName];
                    if (val == undefined){
                        result[valueName]["values"].push(0);
                    } else if (typeof val ==  'number'){
                        result[valueName]["values"].push(val);
                    }
                    result[valueName]["sessionIDs"].push(session.id);
                }
            })
        });
        this.setState({
            valuesPerStatistic: result,
        });
    }

    getBoxPlotArraysEvents(dataPerSession, valueNames){
        const result = {};
        valueNames.forEach(valueName => {
            result[valueName] = {};
            result[valueName]["values"] = [];
            result[valueName]["sessionIDs"] = [];
            Object.values(this.state.sessionListing).forEach(session => {
                if(dataPerSession[session.id] != undefined){
                    const val = dataPerSession[session.id][valueName];
                    if (val == undefined){
                        result[valueName]["values"].push(0);
                    } else if (typeof val ==  'number'){
                        result[valueName]["values"].push(val);
                    }
                    result[valueName]["sessionIDs"].push(session.id);
                }
            })
        });
        this.setState({
            valuesPerEvent: result,
        });

    }

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


    render() {
        let sessionListing = this.state.sessionListing;
        let authToken = this.props.clientMethods.getLoginDetails().token;
        let events = this.state.events;
        


        if (this.state.hasFailed) {
            return(
                <Redirect to="/" />
            );
        }
        
        if (!this.state.flightInfo || !this.state.eventCounts || !this.state.statistics || !this.state.eventTimeline || !this.state.events || !this.state.valuesPerEvent || !this.state.valuesPerStatistic) {
            return(null); // Could add a loading thing here.
        }

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
        let groupPerSession = this.state.groupPerSession;

        
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

        let transforms = visualGroup == "All" ? [] : 
        [
            {
            type: 'filter',
            target: 'customdata',
            operation: '==',
            value: visualGroup
          }
        ];


        const timeSeriesPlots = [];
        events.forEach(event => {

            const y = [];
            const x = [];
            const sessions = [];
            var ct = 0;
            eventTimeline[event]["timestamps"].forEach(function(ts, i){
                if (eventTimeline[event]["sessionIDs"][i] !== null && (visualGroup=="All" || groupPerSession[eventTimeline[event]["sessionIDs"][i]] == visualGroup)){
                    x.push(eventTimeline[event]["timestamps"][i]);
                    y.push(++ct);
                    sessions.push(eventTimeline[event]["sessionIDs"][i]);
                }
            });

            var entry = {
                x: x,
                y: y,
                hovertext: sessions,
                type: 'scatter',
                name: event,
                mode: 'lines+markers',
            };
            timeSeriesPlots.push(entry);
        });

        const boxPlots = [];
        events.forEach(event => {
            const groups = [];
            valuesPerEvent[event]["sessionIDs"].forEach(sessionID => {
                if(this.state.groupPerSession[sessionID] == undefined){
                    groups.push("");
                } else{
                    groups.push(this.state.groupPerSession[sessionID]);
                }
            });

            var entry = {
                y: valuesPerEvent[event]["values"],
                hovertext: valuesPerEvent[event]["sessionIDs"],
                customdata: groups,
                type: 'box',
                name: event,
                jitter: 0.3,
                pointpos: -2,
                boxpoints: 'all',
                transforms: transforms
            };

            boxPlots.push(entry);
        });

        statistics[1].forEach(stat => {
            const groups = [];
            valuesPerStatistic[stat]["sessionIDs"].forEach(sessionID => {
                if(this.state.groupPerSession[sessionID] == undefined){
                    groups.push("");
                } else{
                    groups.push(this.state.groupPerSession[sessionID]);
                }
            });
            var entry = {
                y: valuesPerStatistic[stat]["values"],
                hovertext: valuesPerStatistic[stat]["sessionIDs"],
                customdata: groups,
                type: 'box',
                name: stat,
                jitter: 0.3,
                pointpos: -2,
                boxpoints: 'all',
                transforms: transforms
            };
            boxPlots.push(entry);
        });

        const eventTimelines = [];
        events.forEach(event => {
            const y = [];
            const x = [];
            const sessions = [];
            eventTimeline[event]["timestamps"].forEach(function (e, i){
                if (eventTimeline[event]["sessionIDs"][i] !== null && (visualGroup=="All" || groupPerSession[eventTimeline[event]["sessionIDs"][i]] == visualGroup)){
                    y.push(0.5);
                    x.push(eventTimeline[event]["timestamps"][i]);
                    sessions.push(eventTimeline[event]["sessionIDs"][i]);
                }
            });

            // const groups = [];
            // eventTimeline[event]["sessionIDs"].forEach(sessionID => {
            //     if(this.state.groupPerSession[sessionID] == undefined){
            //         groups.push("");
            //     } else{
            //         groups.push(this.state.groupPerSession[sessionID]);
            //     }
            // });

            
            

            var entry = {
                // x: eventTimeline[event]["timestamps"],
                x: x,
                y: y,
                // hovertext: eventTimeline[event]["sessionIDs"],
                hovertext: sessions,
                // customdata: groups,
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
                // transforms: transforms
            };
            eventTimelines.push(entry);
        });

        let boxTimeseriesLayout = {
            width: 1000, height: 500, 
            yaxis: {
                automargin: true,
            },
            xaxis: {
                automargin: true,
            }};

        let eventTimelinelayout = {
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
            layout = boxTimeseriesLayout;
        } else if(visual == "Event Timeline"){
            plots = eventTimelines;
            layout = eventTimelinelayout;
        }

        const groupselect = [];
        this.getAllGroups().forEach(group =>{
            var groupOption = <option id={group} value={group}>{"Group " + group}</option>;
            groupselect.push(groupOption);
        });

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



        
           
        
        const aggregated = this.aggregateValues();
        const aggEntries = [];
        

        statistics[1].forEach(stat => {
            if(this.state.filters[stat] == undefined){

                aggEntries.push(
                    <span className="centre">
                        <span key={"agg" + stat} className="title mono"> {aggregated["statistics"][stat]} </span>
                    </span>
                    );
            }
        });

        events.forEach(event => {
            if(this.state.filters[event] == undefined){
                aggEntries.push(
                    <span className="centre">
                        <span key={"agg" + event} className="title mono"> {aggregated["events"][event]} </span>
                    </span>
                    );
            }
        });

        return (
            

            <main>
                 
                <section>
                    <div className="header-container">
                        <h1><span onClick={this.toggleFlightStatus} className={`indicator clickable ${this.state.flightInfo.is_active ? 'green' : 'red'}`}></span>{this.state.flightInfo.name}<span className="subtitle">{this.state.flightInfo.application.name}</span></h1>
                        <ul className="buttons-top">
                            <li><Link to={`/flight/${this.state.flightInfo.id}/token/`} className="button">View Authorisation Token</Link></li>
                        </ul>

                   
                    </div>

                    <div className="groupDropdown">

                        <select name="" onChange={(event) => this.setState({visualGroup: event.target.value})}>
                                <option id="all" value="All">All</option>
                                {groupselect}
                            </select>
                    </div>




                    <div className="table aggregated" style={{'--totalEvents': events.length, '--totalStatistics': statistics[1].length, zoom: 0.8, MozTransformStyle: "scale(0.8)", MozTransformOrigin: '0 0'}}>
                            <div className="row header">
                                <span className="icon" > <Link to="" className="icon-container icon-download dark hover" onClick={(e) => this.downloadAggregatedCSV(e)}>Download Aggregated Values</Link></span>

                                {statisticNames}
                                {eventNames}
                            </div>
                            <div className="row double-height">
                                <span className ="centre">
                                    <span></span>
                                </span>
                                {aggEntries}
                            </div>
                    </div>


                    

                    <div className="plotDiv" style={{width: '1000px', height: '500px'}}>
                        <div className="dropdown">
                            <select name="" onChange={(event) => (this.setState({visual: event.target.value}))}>
                                <option id="boxPlots" value="Box Plots">Box Plot</option>
                                <option id="timeSeriesPlots" value="Time Series Plots">Time Series Plots</option>
                                <option id="eventTimelines" value="Event Timeline">Event Timeline</option>
                            </select>
                        </div>
                        <Plot
                                data={
                                plots
                                }
                                layout={ layout}
                            />
                    </div>
                    <div className="filters">
                        <div>Filters</div>
                        {filterEntries}
                    </div>


                    {sessionListing.length == 0 ?
                        <p className="message-box info"><LogUIDevice /> has not yet recorded any sessions for this flight.</p>

                        :
                        

                        <div className="table session analytics" style={{'--totalEvents': events.length, '--totalStatistics': this.state.statistics[this.state.statistics.length - 1].length, height: "300px", zoom: 0.8, MozTransformStyle: "scale(0.8)", MozTransformOrigin: '0 0'}}>
                            <div className="row header"> 
                                <span className="icon" > <Link to="" className="icon-container icon-download dark hover" onClick={(e) => this.downloadStatisticsCSV(e)}>Download Statistics</Link></span>

                                <span className="centre">Group</span>
                                <span className="centre"><strong>SessionID</strong></span>
                                {statisticNames}
                                {eventNames}
                            </div>

                            {Object.keys(sessionListing).map(function(key) {
                                return (
                                    <SessionListItem 
                                    key={sessionListing[key].id}
                                    id={sessionListing[key].id}
                                    events = {events}
                                    eventCounts = {eventCounts[sessionListing[key].id]}
                                    statisticNames = {statistics[statistics.length -1]}
                                    statisticValues = {statistics[0][sessionListing[key].id]}
                                    ip={sessionListing[key].ip_address}
                                    splitTimestamps={sessionListing[key].split_timestamps}
                                    agentDetails={sessionListing[key].agent_details}
                                    authToken={authToken}
                                    setGroup = {setGroup} 
                                    filters = {filters}
                                    link ={`/flight/${flightInfo.id}/dashboard/${sessionListing[key].id}`}
                                    />
                                );
                            })}

                        </div>
                        
                    }


                </section>
            </main>
        );
    }

}

class SessionListItem extends React.Component {

    constructor(props) {
        super(props);
    }


    render() {

        const valuePerStatistic = []
        this.props.statisticNames.forEach(statistic => {
            if(this.props.filters[statistic] == undefined){

                var value = (this.props.statisticValues == undefined) ? 0 : (this.props.statisticValues[statistic] == undefined ? 0 : this.props.statisticValues[statistic]);
                valuePerStatistic.push(
                    <span className="centre">
                        <span key={this.props.id + statistic} className="title mono"> {value} </span>
                    </span>
                );
            }
        });

        const countPerEvent = []
        this.props.events.forEach(event => {
            if(this.props.filters[event] == undefined){

                countPerEvent.push(
                    <span className="centre">
                        <span key={this.props.id + event} className="title mono"> {(this.props.eventCounts == undefined) ? 0 : (this.props.eventCounts[event] == undefined ? 0 : this.props.eventCounts[event])} </span>
                    </span>
                );
            }
        });
        

        return (
            <div className="row double-height">
                <span className ="centre">
                    <span></span>
                </span>
                <span className="centre">
                    <input className="title mono" type="text" style={{width: "60px"}} onChange={event => this.props.setGroup(this.props.id, event.target.value)}/>
                </span>
                <span className="centre">
                    <span className="subtitle mono"><Link to={this.props.link}> {this.props.id} </Link> </span> 
                </span>


                {valuePerStatistic}
                {countPerEvent}

            </div>
        )
    };

}


export default FlightDashboard;