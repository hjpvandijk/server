from os import error
from numpy import nan
import pandas as pd
import json
import math

def dwell_time(session):
    entry = {}

    modal_shows =  session[session["eventDetails.name"] == "MODAL_DIALOG_SHOW"]
    modal_hides =  session[session["eventDetails.name"] == "MODAL_DIALOG_HIDE"]

    outcome = 0
    if(modal_shows.shape[0] != modal_hides.shape[0]):
        entry["total"] = "-"
        entry["average"] = "-"
        return entry
    for i in range(modal_shows.shape[0]):
        show = modal_shows["timestamps.sinceSessionStartMillis"].iloc[i]
        hide = modal_hides["timestamps.sinceSessionStartMillis"].iloc[i]
        diff = hide - show
        outcome += diff
    entry["total"] = int(outcome)
    entry["average"] = outcome/(modal_shows.shape[0]) if outcome > 0 else 0 #Sometimes average outcome results in -0.0, so that is replaced by 0.
    return entry        