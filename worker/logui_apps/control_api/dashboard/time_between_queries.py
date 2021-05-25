def time_between_queries(session):
    # entries = {}
   
    submits = session[ session['eventDetails.type'] == 'submit']
    submits =  submits[submits["eventDetails.name"] == 'QUERY_SUBMITTED']
    outcome = 0
    for i in range(submits.shape[0] - 1):
        query1 = submits["timestamps.sinceSessionStartMillis"].iloc[i]
        query2 = submits["timestamps.sinceSessionStartMillis"].iloc[i+1]
        diff = query2 - query1
        outcome += diff
    # entries[id]["timeBetweenQueries"] = {} 
    # entries[id]["timeBetweenQueries"]["total"] = int(outcome)
    # entries[id]["timeBetweenQueries"]["average"] = outcome/(submits.shape[0]-1) if outcome > 0 else 0 #Sometimes average outcome results in -0.0, so that is replaced by 0.
    entry = {}
    entry["total"] = int(outcome)
    entry["average"] = outcome/(submits.shape[0]-1) if outcome > 0 else 0 #Sometimes average outcome results in -0.0, so that is replaced by 0.
    return entry
