def session_duration(session):
    started = session.head(1)
    stopped = session.tail(1)
    starttime = started["timestamps.sinceSessionStartMillis"].iloc[0]
    stoptime = 0
    duration = 0
    stoptime =  stopped["timestamps.sinceSessionStartMillis"].iloc[0]
    duration = int(stoptime - starttime)

    entry = duration
    return entry