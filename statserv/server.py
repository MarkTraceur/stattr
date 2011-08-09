#!/usr/bin/python

# Copyright 2011 Mark Holmquist
#
# This file is part of stattr.
# stattr is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# stattr is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with stattr.  If not, see <http://www.gnu.org/licenses/>.

import json
import hashlib
import random
import os
import sys

from flask import Flask, request
from pymongo import Connection, ASCENDING, DESCENDING

# -------------------------------
#       Utility functions
# -------------------------------

def determine_path():
    """Borrowed from wxglade.py"""
    try:
        root = __file__
        if os.path.islink(root):
            root = os.path.realpath(root)
        return os.path.dirname (os.path.abspath(root))
    except:
        print "I'm sorry, but something is wrong."
        print "There is no __file__ variable. Please contact the author."
        sys.exit()

def make_response(cb, response):
    return cb + '(' + json.dumps(response) + ');'

def send_error(request, message):
    return make_response(request.args.get('callback', ''),
                         {'error': message})

def send_file(filename):
    return open(determine_path() + filename).read()

def read_conf():
    config = {}
    ourconf = open(determine_path() + '/stattrd.conf')
    for line in ourconf.read().split('\n'):
        if len(line.split('=')) > 1:
            config[line.split('=')[0]] = line.split('=')[1]
        else:
            config[line.split('=')[0]] = ''
    return config

def build_database(db, conf):
    # Create and populate config table, if it doesn't exist
    confcol = db.stattrconf
    if not confcol.find_one():
        confcol.insert({'sitename': conf['sitename'],
                        'logo': conf['logourl'],
                        'location': conf['location']})

    # Create users table if not there
    usercol = db.stattrusers
    if not usercol.find_one({'username': conf['adminuser']}):
        usercol.insert({'username': conf['adminuser'],
                        'password': hashlib.sha1(conf['adminpass']).hexdigest(),
                        'admin': True,
                        'fullname': 'admin',
                        'profile': ''})

def make_session(username, hostname, admin):
    if hostname == None:
        # We're probably in a test environment, or something is screwy.
        hostname = '127.0.0.1'
    idNum = hashlib.sha1(username + hostname + \
                         str(random.random())).hexdigest()
    sessions[idNum] = (username, hostname, admin)
    return idNum

def check_auth(username, hostname, session, needadmin=False):
    if username == '' or session == '':
        return {'logged': False,
                'admin': False,
                'error': 'auth error: Need a username and session ID'}
    elif not session in sessions:
        return {'logged': False,
                'admin': False,
                'error': 'auth error: Session data not present on server'}
    elif sessions[session][0] != username\
         or sessions[session][1] != hostname:
        return {'logged': False,
                'admin': False,
                'error': 'auth error: Session data does not match'}
    elif sessions[session][2]:
        return {'logged': True,
                'admin': True}
    elif needadmin:
        return {'logged': True,
                'admin': False,
                'error': 'auth error: Session does not '\
                         'have admin priveleges'}
    else:
        return {'logged': True,
                'admin': False}
    
# ------------------------
# Define a few app globals
# ------------------------

config = read_conf()
sessions = {}
database = Connection()[config['dbname']]
tplList = ['home', 'header', 'login', 'userbar', 'admin',
           'eventcreate', 'eventhome', 'usercreate', 'resultsadd',
           'userchoose', 'eventchoose', 'usermodify', 'eventmodify',
           'profile']
build_database(database, config)
stattr_server = Flask(__name__)

# Redirect / to /static/index.html
@stattr_server.route('/')
def index_page():
    return send_file('/static/index.html')

# -------------------
#    GET functions
# -------------------
    
@stattr_server.route('/tpls.json')
def get_tpls():
    which = request.args.getlist('which')
    wset = set(which)
    tplset = set(tplList)
    if not wset.issubset(tplset) and 'all' not in which and which != ['']:
        return send_error(request, 'template does not exist')
    else:
        ourpath = determine_path()
        tpls = {}
        if 'all' in which or which == ['']:
            which = tplList
        for tpl in which:
            openStr = ourpath + '/tpls/' + tpl + '.tpl'
            tpls[tpl] = open(openStr, 'r').read()
        return make_response(request.args.get('callback', ''), tpls)
        
@stattr_server.route('/conf.json')
def get_conf():
    theconf = database.stattrconf.find_one()
    del theconf['_id']
    return make_response(request.args.get('callback', ''), theconf)

@stattr_server.route('/events.json')
def get_events():
    raw_results = list(database.stattrtbls.find())
    eventslist = []
    for r in raw_results:
        eventslist.append({'id': r['id'],
                           'activity': r['activity'],
                           'descr': r['descr']})
    return make_response(request.args.get('callback', ''),
                         {'events': eventslist})

@stattr_server.route('/isadmin.json')
def get_admin():
    username = request.args.get('_username', '')
    session = request.args.get('_session', '')
    result = check_auth(username, request.remote_addr, session)
    if 'error' in result:
        return send_error(request, result['error'])
    else:
        return make_response(request.args.get('callback', ''),
                             {'isAdmin': result['admin']})

@stattr_server.route('/event.json')
def get_event():
    if request.args.get('_method', '') == 'POST':
        return add_event(request)
    elif request.args.get('_method', '') == 'PUT':
        return mod_event(request)
    eventid = request.args.get('id', '')
    if eventid == '':
        return send_error(request, 'need to know what event you '\
                                   'want to complete this request')
    pagenum = request.args.get('page', 0, type=int)
    wantresults = request.args.get('results', '')
    tblcol = database.stattrtbls
    eventcol = database[eventid]

    tbldoc = tblcol.find_one({'id': eventid})
    if not tbldoc:
        return send_error(request, 'that event does not seem to exist....')
    del tbldoc['_id']
    resultlist = []
    if wantresults != 'false':
        rawlist = list(eventcol.find())
        for result in rawlist:
            del result['_id']
            resultlist.append(result)

    if pagenum > 0:
        start = 10 * (pagenum - 1)
        return make_response(request.args.get('callback', ''),
                             {'page': resultlist[start:start+10]})
    elif len(resultlist) <= 0 or wantresults == 'false':
        return make_response(request.args.get('callback', ''),
                             {'table': tbldoc})
    else:
        return make_response(request.args.get('callback', ''),
                             {'events': resultlist, 'table': tbldoc})

@stattr_server.route('/users.json')
def get_users():
    auth = check_auth(request.args.get('_username'),
                      request.remote_addr,
                      request.args.get('_session'),
                      needadmin=True)
    if 'error' in auth:
        return send_error(request,
                          auth['error'])
    usercol = database.stattrusers
    userobj = usercol.find({'username': {'$ne': config['adminuser']}})
    userlist = []
    for user in userobj:
        del user['password']
        del user['_id']
        userlist.append(user)
    return make_response(request.args.get('callback', ''),
                         {'users': userlist})

@stattr_server.route('/user.json')
def get_user():
    method = request.args.get('_method', '')
    if method == 'POST':
        return add_user(request)
    elif method == 'PUT':
        return mod_user(request)
    auth = check_auth(request.args.get('_username'),
                      request.remote_addr,
                      request.args.get('_session'),
                      needadmin=True)
    if 'error' in auth:
        return send_error(request, auth['error'])
    username = request.args.get('username', '')
    usercol = database.stattrusers
    dbuser = usercol.find_one({'username': username})
    if not dbuser:
        return send_error(request, 'that user does not seem to exist....')
    del dbuser['password']
    del dbuser['_id']
    return make_response(request.args.get('callback', ''), dbuser)

@stattr_server.route('/profile.json')
def get_profile():
    username = request.args.get('username', '')
    tablecol = database.stattrtbls
    user = database.stattrusers.find_one({'username': username})
    del user['_id']
    del user['password']
    data = {}
    fields = {}
    for table in tablecol.find({}):
        data[table['id']] = []
        thistbl = database[table['id']]
        for result in thistbl.find({'participants': username}):
            del result['_id']
            data[table['id']].append(result)
        if len(data[table['id']]) == 0:
            del data[table['id']]
        else:
            fields[table['id']] = {'types': table['types'],
                                   'fields': table['fields'],
                                   'activity': table['activity'],
                                   'descr': table['descr']}
    return make_response(request.args.get('callback', ''),
                         {'user': user, 'results': data, 'events': fields})

# -----------------
# POST functions
# -----------------

@stattr_server.route('/login.json')
def login():
    usercol = database.stattrusers
    username = request.args.get('username', '')
    password = request.args.get('password', '')
    if password == '' or username == '':
        return send_error(request, 'need to supply username and password')
    dbuser = usercol.find_one({'username': username})
    if not dbuser:
        return send_error(request, 'user does not exist')
    if password != dbuser['password']:
        return send_error(request, 'incorrect password')
    sessionid = make_session(username, request.remote_addr, dbuser['admin'])
    return make_response(request.args.get('callback', ''),
                         {'session': sessionid, 'username': username,
                          'admin': dbuser['admin']})

def add_event(request):
    auth = check_auth(request.args.get('_username'),
                      request.remote_addr,
                      request.args.get('_session'),
                      needadmin=True)
    if 'error' in auth:
        return send_error(request, auth['error'])
    activity = request.args.get('activity', '')
    variables = request.args.getlist('variables')
    variables.insert(0, 'participants')
    types = request.args.getlist('types')
    types.insert(0, 'varchar')
    officials = request.args.get('officials', '')
    descr = request.args.get('descr', '')
    eventid = request.args.get('id', '')
    regexes = request.args.getlist('regexes')
    froms = request.args.getlist('from')
    tos = request.args.getlist('to')
    if activity == ''\
       or variables == []\
       or types == []\
       or officials ==''\
       or descr == '':
        return send_error('data not sufficient to create event')
    elif eventid == '':
        eventid = activity.split()[0]
        eventid += hashlib.sha1(descr).hexdigest()[0:8]
    if not database.stattrtbls.find_one({'id': eventid}): 
        officials = officials.split(',')
        officiallist = []
        for official in officials:
            officiallist.append(official.split()[0])
        database.stattrtbls.insert({'id': eventid,
                                    'activity': activity,
                                    'descr': descr,
                                    'officials': officiallist,
                                    'fields': variables,
                                    'types': types,
                                    'checks': regexes,
                                    'rstarts': froms,
                                    'rends': tos})
        return make_response(request.args.get('callback', ''), {})
    else:
        return send_error(request,
                          'event already exists, create a unique ID')

def add_user(request):
    auth = check_auth(request.args.get('_username'),
                      request.remote_addr,
                      request.args.get('_session'),
                      needadmin=True)
    if 'error' in auth:
        return send_error(request, auth['error'])
    username = request.args.get('username', '')
    password = request.args.get('password', '')
    fullname = request.args.get('fullname', '')
    admin = request.args.get('admin', '') == 'true'
    profile = request.args.get('profile', '')
    usercol = database.stattrusers
    if username == ''\
       or password == ''\
       or fullname == ''\
       or admin == '':
        return send_error(request, 'data not sufficient to create user')
    elif usercol.find_one({'username': username}):
        return send_error(request, 'user already exists')
    else:
        usercol.insert({'username': username, 'password': password,
                        'admin': admin, 'fullname': fullname,
                        'profile': profile})
        return make_response(request.args.get('callback', ''), {})
    
@stattr_server.route('/results.json')
def add_results():
    auth = check_auth(request.args.get('_username'),
                      request.remote_addr,
                      request.args.get('_session'))
    if 'error' in auth:
        return send_error(request, auth['error'])
    event = request.args.get('event', '')
    results = request.args.getlist('results')
    if event == ''\
       or results == '':
        return send_error(request, 'server needs data to create a resultset')
    else:
        tbldoc = database.stattrtbls.find_one({'id': event})
        fields, types = tbldoc['fields'], tbldoc['types']
        eventcol = database[event]
        results = dict([(fieldname, field.split(','))\
                        for fieldname, field in zip(fields, results)])
        while 'bool' in types:
            ouri = types.index('bool')
            types[ouri] = 'done'
            results[fields[ouri]] = [thisbool == 'true'
                                     for thisbool in results[fields[ouri]]]
        while 'int' in types or 'double' in types:
            ouri = types.index('int') or types.index('double')
            thistype = types[ouri]
            types[ouri] = 'done'
            results[fields[ouri]] = [(int(thisnum) if thistype == 'int'
                                      else float(thisnum)) 
                                     for thisnum in results[fields[ouri]]]
        eventcol.insert(results)
        return make_response(request.args.get('callback', ''), {})

# -----------------
# PUT functions
# -----------------

def mod_event(request):
    auth = check_auth(request.args.get('_username'),
                      request.remote_addr,
                      request.args.get('_session'),
                      needadmin=True)
    if 'error' in auth:
        return send_error(request, auth['error'])
    activity = request.args.get('activity', '')
    variables = request.args.getlist('variables')
    variables.insert(0, 'participants')
    types = request.args.getlist('types')
    types.insert(0, 'varchar')
    officials = request.args.get('officials', '')
    descr = request.args.get('descr', '')
    eventid = request.args.get('id', '')
    oldid = request.args.get('oldid', '')
    regexes = request.args.getlist('regexes')
    froms = request.args.getlist('from')
    tos = request.args.getlist('to')
    if activity == ''\
       or variables == []\
       or types == []\
       or officials == ''\
       or oldid == ''\
       or descr == '':
        return send_error('data not sufficient to modify event')
    elif eventid == '':
        eventid = activity.split()[0]
        eventid += hashlib.sha1(descr).hexdigest()[0:8]
    database.stattrtbls.remove({'id': oldid})
    if not database.stattrtbls.find_one({'id': eventid}):
        officials = officials.split(',')
        officiallist = []
        for official in officials:
            officiallist.append(official.split()[0])
        database.stattrtbls.insert({'id': eventid,
                                    'activity': activity,
                                    'descr': descr,
                                    'officials': officiallist,
                                    'fields': variables,
                                    'types': types,
                                    'checks': regexes,
                                    'rstarts': froms,
                                    'rends': tos})
        if oldid != eventid:
            for doc in database[oldid].find():
                database[eventid].insert(doc)
        return make_response(request.args.get('callback', ''), {})
    else:
        return send_error(request,
                          'event already exists, create a unique ID')

def mod_user(request):
    auth = check_auth(request.args.get('_username'),
                      request.remote_addr,
                      request.args.get('_session'),
                      needadmin=True)
    if 'error' in auth:
        return send_error(request, auth['error'])

    olduser = request.args.get('olduser', '')
    username = request.args.get('username', '')
    password = request.args.get('password', '')
    fullname = request.args.get('fullname', '')
    admin = request.args.get('admin', '') == 'true'
    profile = request.args.get('profile', '')
    usercol = database.stattrusers
    thisuser = usercol.find_one({'username': olduser})
    usercol.remove({'username': olduser})
    del thisuser['_id']
    if username == ''\
       or fullname == ''\
       or admin == '':
        return send_error(request, 'data not sufficient for a user')
    elif username != olduser\
         and usercol.find_one({'username': username}):
        return send_error(request, 'user already exists')
    else:
        thisuser['username'] = username
        thisuser['fullname'] = fullname
        thisuser['admin'] = admin
        thisuser['profile'] = profile
        if password != '':
            thisuser['password'] = password
        usercol.insert(thisuser)
        return make_response(request.args.get('callback', ''), {})

# -----------------
# Start server
# -----------------

def start():
    stattr_server.run(host='0.0.0.0',
                      debug=True,
                      port=(int(config['port']) or 54321))
