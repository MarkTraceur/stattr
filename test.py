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

import unittest
import os.path
import hashlib

from flask import Flask, request, Request
from pymongo import Connection, ASCENDING, DESCENDING

import statserv.server

class UtilityFunctionTestCase(unittest.TestCase):
    def testDeterminePath(self):
        self.assertTrue(os.path.exists(statserv.server.determine_path()),
                        'The determine_path method is broken.')
    
    def testMakeResponse(self):
        self.assertEquals('test({});',
                          statserv.server.make_response('test', {}),
                          'The make_response method is broken. '\
                          'It should have given us: `test({});` '\
                          'Instead, it gave us:`%s`' %\
                          statserv.server.make_response('test', {}))

    def testSendError(self):
        try:
            self.testMakeResponse()
        except:
            pass
        app = Flask(__name__)
        with app.test_client() as c:
            testRequest = c.get('/?callback=blah')
            self.assertEquals('blah({\"error\": \"No workee\"});',
                              statserv.server.send_error(request,
                                                         'No workee'),
                              'The send_error method is broken. '\
                              'It should have given us: `'\
                              'blah({\"error\": \"No workee\"});` '\
                              'Instead, it gave us:`%s`' %\
                              statserv.server.send_error(request,
                                                         'No workee'))

    def testSendFile(self):
        try:
            self.testDeterminePath()
        except:
            pass
        thisfile = statserv.server.determine_path()
        self.assertEquals(open(thisfile + '/server.py').read(),
                          statserv.server.send_file('/server.py'),
                          'The send_file method is broken, but it would be hard'\
                          ' to print the entire expected and actual output. '\
                          'Have the actual output: `%s`' %\
                          statserv.server.send_file('/server.py'))

    def testReadConf(self):
        try:
            self.testDeterminePath()
        except:
            pass
        oldconf = open(statserv.server.determine_path() + '/stattrd.conf').read()
        thefile = open(statserv.server.determine_path() + '/stattrd.conf', 'w')
        thefile.truncate(0)
        thefile.write('dbname=example\nport=54321\noptions=\nsitename=test')
        thefile.close()
        try:
            self.assertEquals(dict({'dbname': 'example',
                                    'port': '54321',
                                    'options': '',
                                    'sitename': 'test'}),
                              statserv.server.read_conf())
        except:
            failmsg = statserv.server.read_conf()
            thefile = open(statserv.server.determine_path() + '/stattrd.conf',
                           'w')
            thefile.truncate(0)
            thefile.write(oldconf)
            thefile.close()
            self.fail('The read_conf method is broken. We expected: `'\
                 '{\'dbname\': \'example\', \'port\': \'54321\', '\
                 '\'options\': \'\', \'sitename\': \'test\'}`, but'\
                 ' we got: `%s`' % failmsg)
        thefile = open(statserv.server.determine_path() + '/stattrd.conf', 'w')
        thefile.truncate(0)
        thefile.write(oldconf)
        thefile.close()

    def testBuildDatabase(self):
        conn = Connection()
        dbname = 'test_db'
        db = conn[dbname]
        conf = dict({u'logourl': u'http://imgur.com/123456.png',
                     u'location': u'redlands, ca',
                     u'sitename': u'test',
                     u'adminuser': u'admin',
                     u'adminpass': u'password'})
        ourconf = dict({u'logo': u'http://imgur.com/123456.png',
                        u'location': u'redlands, ca',
                        u'sitename': u'test'})
        password = u'%s' % hashlib.sha1('password').hexdigest()
        ouradmin = dict({u'username': u'admin',
                         u'profile': u'',
                         u'password':
                             u'5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8',
                         u'admin': True,
                         u'fullname': u'admin'})
        statserv.server.build_database(db, conf)
        dbconf = db.stattrconf.find_one()
        dbadmin = db.stattrusers.find_one({'username': 'admin'})
        del dbconf['_id']
        del dbadmin['_id']
        self.assertEquals(dbconf, ourconf,
                          'The build_database method is broken. Somehow, '\
                          'the config we put in didn\'t come out the same when'\
                          ' we got it back from the database.')
        self.assertEquals(dbadmin, ouradmin,
                          'The build_database method is broken. Somehow, '\
                          'the admin user we put in didn\'t come out the same '\
                          'when we got it back from the database. We expected: '\
                          '`{u\'username\': u\'admin\', u\'profile\': u\'\','\
                          ' u\'password\': '\
                          'u\'5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8\''\
                          ', u\'admin\': True, u\'fullname\': u\'admin\''\
                          '}`. We got: `%s`' % dbadmin)

    def testMakeSession(self):
        theid = statserv.server.make_session('username', '127.0.0.1', False)
        try:
            test = statserv.server.sessions[theid]
        except KeyError:
            self.fail('The make_session method is broken. The ID returned by it'\
                      ' does not correctly reference the generated session.')
        self.assertEquals(('username', '127.0.0.1', False),
                          test,
                          'The make_session method is broken. For some reason, '\
                          'the tuple we got from the sessions dictionary is not'\
                          'the correct information. We expected: `(\'username\''\
                          ', \'127.0.0.1\', False)`. We got: '\
                          '`%s`' % repr(test))

    def testCheckAuth(self):
        try:
            self.testMakeSession()
        except:
            pass
        testdict = {'logged': False,
                    'admin': False,
                    'error': 'auth error: Need a username and session ID'}
        self.assertEquals(statserv.server.check_auth('', '127.0.0.1', ''),
                          testdict,
                          'The check_auth method should reject authorization '\
                          'when not given any credentials at all.')
        testdict['error'] = 'auth error: Session data not present on server'
        self.assertEquals(statserv.server.check_auth('admin', '127.0.0.1', '0'),
                          testdict,
                          'The check_auth method should reject authorization '\
                          'when given non-existent session IDs.')
        testdict['error'] = 'auth error: Session data does not match'
        statserv.server.sessions['0'] = ('admin', '127.0.0.1', True)
        self.assertEquals(statserv.server.check_auth('admin', '127.0.0.2', '0'),
                          testdict,
                          'The check_auth method should reject authorization '\
                          'when given non-matching session data.')
        del testdict['error']
        testdict['logged'] = True
        testdict['admin'] = True
        self.assertEquals(statserv.server.check_auth('admin', '127.0.0.1', '0'),
                          testdict,
                          'The check_auth method should return positive admin '\
                          'priveleges when given proper credentials for an '\
                          'admin-enabled session.')
        testdict['admin'] = False
        testdict['error'] = 'auth error: Session does not '\
                            'have admin priveleges'
        statserv.server.sessions['0'] = ('admin', '127.0.0.1', False)
        self.assertEquals(statserv.server.check_auth('admin', '127.0.0.1',
                                                     '0', True),
                          testdict,
                          'The check_auth method should allow login but refuse '\
                          'admin priveleges when the session exists and the '\
                          'credentials are correct, but the user is non-admin.')
        del testdict['error']
        self.assertEquals(statserv.server.check_auth('admin', '127.0.0.1', '0'),
                          testdict,
                          'The check_auth method should allow login but refuse '\
                          'admin priveleges when the session exists and the '\
                          'credentials are correct, but the user is non-admin.')

if __name__ == '__main__':
    unittest.main()
