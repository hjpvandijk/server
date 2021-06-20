def session_duration(session): #problem is session can have multiple start/stop statusevents because of reloading.
    statusEvents = session[ session['eventType'] == 'statusEvent']
    started = statusEvents[ statusEvents['eventDetails.type'] == 'started']
    stopped = statusEvents[ statusEvents['eventDetails.type'] == 'stopped']
    starttime = started["timestamps.sinceSessionStartMillis"].head(1).iloc[0]
    stoptime = 0
    duration = 0
    if stopped["timestamps.sinceSessionStartMillis"].tail(1).size > 0:
        stoptime =  stopped["timestamps.sinceSessionStartMillis"].tail(1).iloc[0]
        duration = int(stoptime - starttime)
    else:
        stoptime = session.tail(1)["timestamps.sinceSessionStartMillis"].iloc[0]
        duration = int(stoptime - starttime)
    entry = duration
    return entry