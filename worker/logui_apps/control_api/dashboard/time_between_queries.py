def time_between_queries(session):   
    submits = session[ session['eventDetails.type'] == 'submit']
    outcome = 0
    for i in range(submits.shape[0] - 1):
        query1 = submits["timestamps.sinceSessionStartMillis"].iloc[i]
        query2 = submits["timestamps.sinceSessionStartMillis"].iloc[i+1]
        diff = query2 - query1
        outcome += diff
        entry = {}
    entry["total"] = int(outcome)
    entry["average"] = outcome/(submits.shape[0]-1) if outcome > 0 else 0 #Sometimes average outcome results in -0.0, so that is replaced by 0.
    return entry
