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
            eventCounts: null,
            statistics: null,
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
        this.props.clientMethods.setMenuComponent(Menu);
        this.props.clientMethods.setTrailComponent(this.getTrail());
    }

    async componentDidUpdate(prevProps) {
        if (this.props.match.params.id !== prevProps.match.params.id) {
            await this.getFlightDetails();
            await this.getSessionListings();
            await this.getEventCounts();
            await this.getStatistics();
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
        var response = fetch(`${Constants.SERVER_API_ROOT}flight/dashboard/eventcount/${this.state.flightInfo.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
            })
            .then(resp => resp.json())  // Take the json array that is returned by the server.
            .then(jsonObj => {             // Create a zipfile containing all screencaptures, named with their corresponding session id.                
                this.setState({
                    eventCounts: jsonObj,
                });
            });
    };

    async getStatistics() {
        var response = fetch(`${Constants.SERVER_API_ROOT}flight/dashboard/statistics/${this.state.flightInfo.id}/`, {
            method: 'GET',
            headers: {
                'Authorization': `jwt ${this.props.clientMethods.getLoginDetails().token}`
            },
            })
            .then(resp => resp.json())  // Take the json array that is returned by the server.
            .then(jsonObj => {             // Create a zipfile containing all screencaptures, named with their corresponding session id.                
                console.log(jsonObj)
                this.setState({
                    statistics: jsonObj,
                });
            });
    };

    render() {
        let sessionListing = this.state.sessionListing;
        let authToken = this.props.clientMethods.getLoginDetails().token;
        let eventCounts = this.state.eventCounts;
        let statistics = this.state.statistics;


        if (this.state.hasFailed) {
            return(
                <Redirect to="/" />
            );
        }
        
        if (!this.state.flightInfo || !this.state.eventCounts || !this.state.statistics) {
            return(null); // Could add a loading thing here.
        }

        const statisticNames = [];
        this.state.statistics[this.state.statistics.length - 1].forEach(element => {
            var el = <span className="double centre" >
                <span key={element+"_title"} className="title analytics">{element}</span>
                <span key={element+"_subtitle"} className="subtitle">statistic</span>
            </span>
            statisticNames.push(el)
        });

        const eventNames = [];
        this.state.eventCounts[this.state.eventCounts.length - 1].forEach(element => {
            var el = <span className="double centre" >
                <span key={element+"_title"} className="title analytics">{element}</span>
                <span key={element+"_subtitle"} className="subtitle">event</span>
            </span>
            eventNames.push(el)
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

                    <p>
                        Browsing sessions that have been captured on {this.state.flightInfo.application.name} by <LogUIDevice /> are listed here. Metadata about each session (e.g., the browser used) is shown.
                    </p>
                    {this.state.flightInfo.is_active ?
                        <p><LogUIDevice /> is currently accepting new sessions for this flight.</p>
                        :
                        <p><LogUIDevice /> is <strong>not</strong> currently accepting new sessions for this flight.</p>
                    }

                    {/* <Plot
                            data={[
                            {
                                x: [1, 2, 3],
                                y: [2, 6, 3],
                                type: 'scatter',
                                mode: 'lines+markers',
                                marker: {color: 'red'},
                            },
                            {type: 'bar', x: [1, 2, 3], y: [2, 5, 3]},
                            ]}
                            layout={{width: 320, height: 240, title: 'A Fancy Plot'}}
                        /> */}

                    

                    {sessionListing.length == 0 ?
                        <p className="message-box info"><LogUIDevice /> has not yet recorded any sessions for this flight.</p>

                        :
                        

                        <div className="table session analytics" style={{'--totalEvents': this.state.eventCounts[this.state.eventCounts.length - 1].length, '--totalStatistics': this.state.statistics[this.state.statistics.length - 1].length}}>
                            <div className="row header">
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
                                    events = {eventCounts[eventCounts.length - 1]}
                                    eventCounts = {eventCounts[0][sessionListing[key].id]}
                                    statisticNames = {statistics[statistics.length -1]}
                                    statisticValues = {statistics[0][sessionListing[key].id]}
                                    ip={sessionListing[key].ip_address}
                                    splitTimestamps={sessionListing[key].split_timestamps}
                                    agentDetails={sessionListing[key].agent_details}
                                    authToken={authToken} />
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
            var value = (this.props.statisticValues == undefined) ? 0 : (this.props.statisticValues[statistic] == undefined ? 0 : this.props.statisticValues[statistic]);
            valuePerStatistic.push(
                <span className="centre">
                    <span key={this.props.id + statistic} className="title mono"> {value} </span>
                </span>
            );
        });

        const countPerEvent = []
        this.props.events.forEach(event => {
            countPerEvent.push(
                <span className="centre">
                    <span key={this.props.id + event} className="title mono"> {(this.props.eventCounts == undefined) ? 0 : (this.props.eventCounts["value_counts"][event] == undefined ? 0 : this.props.eventCounts["value_counts"][event])} </span>
                </span>
            );
        });
        

        return (
            <div className="row double-height">
                <span className="centre">
                    <input className="title mono" type="text" style={{width: "60px"}}/>
                    {/* <span className="title mono">1</span> */}
                </span>
                <span className="centre">
                    <span className="subtitle mono">{this.props.id}</span>
                </span>

                {/* <span className="double centre">
                    <span className="title mono"> {(this.props.eventCounts == undefined) ? 0 : (this.props.eventCounts["value_counts"]["inputgrouptest"] == undefined ? 0 : this.props.eventCounts["value_counts"]["inputgrouptest"])} </span>
                </span> */}
                {valuePerStatistic}
                {countPerEvent}
                    
                {/* <span className="icon"><span className={`icon-container icon-${this.props.agentDetails.is_desktop ? 'desktop': 'phone'} dark`}></span></span>
                <span className="icon"><span className={`icon-container icon-${iconClassOS} dark`}></span></span>
                <span className="browser icon"><span className={`icon-container icon-${iconClassBrowser} dark`}></span></span>
                <span><span className={`indicator ${this.props.splitTimestamps.end_timestamp ? 'green' : 'orange'}`}></span></span> */}
            </div>
        )
    };

}


export default FlightDashboard;