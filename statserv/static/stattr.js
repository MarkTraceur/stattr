/*

Copyright 2011 Mark Holmquist

This file is part of stattr.

stattr is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

stattr is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with stattr.  If not, see <http://www.gnu.org/licenses/>.

*/

function createCookie(name,value,hours) {
    var expires;
    if (hours) {
        var date = new Date();
        date.setTime(date.getTime()+(hours*60*60*1000));
        expires = "; expires="+date.toGMTString();
    }
    else expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name,"",-1);
}

function haveJquery(cb) {
    if (typeof jQuery != 'function') {
        var scriptEle = document.createElement('script');
        scriptEle.setAttribute('type', 'text/javascript');
        scriptEle.setAttribute('src', 'http://ajax.googleapis.com/ajax/libs/jquery/1.5/jquery.min.js');
        document.head.appendChild(scriptEle);
    }
    cb();
}

function startStattr() {
    var stattrDomain = 'http://' + document.location.hostname;
    var stattrPort = document.location.port;
    var stDat = {};
    jQuery.ajaxSettings.traditional = true;

    stGet({}, 'conf', loadApp);

    function stGet(data, what, cb) {
        if (stDat && stDat.session && stDat.username) {
            data['_session'] = stDat.session;
            data['_username'] = stDat.username;
        }
        var url = stattrDomain + ':' + stattrPort + '/' + what + '.json?callback=?';
        $.getJSON(url, data, function(data) {
		if (data && data.error && data.error.slice(0, 10) == 'auth error') {
		    homePage();
		    stDat.$error.html(data.error).delay(2000).empty();
		}
		cb(data);
	    });
    }

    function stPost(data, what, cb) {
        data._method = 'POST';
        stGet(data, what, cb);
    }

    function stPut(data, what, cb) {
        data._method = 'PUT';
        stGet(data, what, cb);
    }

    function stLoad(tpl) {
        if (stDat.$error)
            stDat.$error.empty();
        if (stDat.$main)
            stDat.$main.html(stDat.tpls[tpl]);
    }

    function makeUserLink(username) {
	$theLink = $(document.createElement('a'));
	$theLink.addClass('stattr-style-user-link');
	$theLink.html(username);
	$theLink.attr('href', 'javascript:');
	$theLink.click(function() {
	    stGet({'username': username}, 'profile', userProfile);
	});
	return $theLink;
    }

    function login(cb) {
        stLoad('login');
        $submit = $('input#stattr-js-login-submit');
        $submit.click(function() {
            $frm = $('form#stattr-js-login-form', stDat.$main);
            $pass = $('input[name=password]', $frm);
            $usr = $('input[name=username]', $frm);
            password = Crypto.SHA1($pass.val());
            user = $usr.val().toLowerCase();
            stPost({'password': password, 'username': user}, 'login', function(data) {
                if (data.session) {
                    stDat.session = data.session;
                    stDat.loggedIn = true;
                    stDat.$logger.attr('value', 'Logout');
                    stDat.$logger.click(logout);
                    stDat.username = data.username;
                    stDat.isAdmin = data.admin;
                    userbarSetup();
                    eraseCookie('stattr-session-' + stDat.cfg.sitename);
                    eraseCookie('stattr-username-' + stDat.cfg.sitename);
                    createCookie('stattr-session-' + stDat.cfg.sitename, data.session, 1);
                    createCookie('stattr-username-' + stDat.cfg.sitename, data.username, 1);
                    cb();
                }
                else if (data.error)
                    stDat.$error.html(data.error);
            });
            return 0;
        });
    }

    function logout() {
        stDat.session = null;
        stDat.loggedIn = false;
        stDat.isAdmin = false;
        stDat.$logger.attr('value', 'Login');
        stDat.$logger.click(function() {
            login(homePage);
            return 0;
        });
        userbarSetup();
        eraseCookie('stattr-session-' + stDat.cfg.sitename);
        eraseCookie('stattr-username-' + stDat.cfg.sitename);
        homePage();
    }

    function userbarSetup(data) {
        stDat.$userbar.html(stDat.tpls.userbar);
        if (data && !data.error) {
            stDat.isAdmin = data.isAdmin;
        }
        else if (!stDat.loggedIn || (data && data.error)) {
            stDat.isAdmin = false;
	    stDat.session = false;
            stDat.loggedIn = false;
            stDat.username = 'guest';
	}

	if (stDat.loggedIn) {
            stDat.$logger.attr('value', 'Logout');
            stDat.$logger.click(logout);
            $('span#stattr-js-userbar-username').html(makeUserLink(stDat.username));
        }
	else {
            $('span#stattr-js-userbar-username').html(stDat.username);
	    stDat.$logger.attr('value', 'Login');
	    stDat.$logger.click(function() {
		    login(homePage);
		});
	}

        $('a#stattr-js-userbar-home-button', stDat.$userbar).click(function() {
            if (stDat.cfg && stDat.events)
                homePage();
            else
                loadApp();
            return 0;
        });

        if (stDat.isAdmin && stDat.loggedIn)
            $('a#stattr-js-userbar-admin-button', stDat.$userbar).click(adminPanel);
        else
            $('span#stattr-js-userbar-admin-button-contain', stDat.$userbar).remove();
    }

    function loadApp(data) {
        if (data && !data.error)
            stDat.cfg = data;
        stDat.tpls = {};
        stGet({'which': 'all'}, 'tpls', function(data) {
            stDat.tpls = data; // get all tpls for now, maybe change later if tpls get too big
            stGet({}, 'events', homePage);
        });
        stDat.$contain = $('div#stattr-contain');
        stDat.session = readCookie('stattr-session-' + stDat.cfg.sitename);
        if (stDat.session) {
            stDat.loggedIn = true;
            stDat.username = readCookie('stattr-username-' + stDat.cfg.sitename);
        }
    }

    function homePage(data) {
        if (data && data.events) // get data, if it exists
            stDat.events = data.events;

        if (!stDat.$header || !stDat.$header.length) { // make sure the header has loaded
            stDat.$header = $('div#stattr-header');
            if (!stDat.$header.length) {
                stDat.$contain.prepend(stDat.tpls.header);
                stDat.$header = $('div#stattr-header');
                stDat.$userbar = $('div#stattr-js-userbar', stDat.$header);
                $('img#stattr-js-logo', stDat.$header).attr('src', stDat.cfg.logo);
                $('span#stattr-js-name', stDat.$header).html(stDat.cfg.sitename);
                $('span#stattr-js-location', stDat.$header).html(stDat.cfg.location);
                stDat.$logger = $('input#stattr-js-logger', stDat.$header);
                stDat.$logger.attr('value', 'Login');
                stDat.$logger.click(function() {
                    login(homePage);
                    return 0;
                });
            }
            if (!stDat.$error || !stDat.$error.length) {
                stDat.$error = $('div#stattr-js-errors', stDat.$header);
            }
        }

	if (stDat.loggedIn)
	    stGet({}, 'isadmin', userbarSetup);
	else
	    userbarSetup();

        if (!stDat.$main || !stDat.$main.length) { // make sure our main div has been initialized
            stDat.$main = $('div#stattr-main');
            if (!stDat.$main.length) {
                stDat.$contain.append('<div id="stattr-main"></div>');
                stDat.$main = $('div#stattr-main');
            }
        }

        stLoad('home');

        $slct = $('select#stattr-js-event-select', stDat.$main);
        if (!stDat.events[0] || stDat.events[0].id != ' ')
            stDat.events.unshift({id: ' ', activity: ' '});
        for (var i in stDat.events) {
            ourOpt = document.createElement('option');
            ourOpt.setAttribute('value', stDat.events[i].id);
            ourOpt.innerHTML = stDat.events[i].activity;
            if (stDat.events[i].activity != ' ')
                ourOpt.innerHTML +=  ': ' + stDat.events[i].descr;
            $slct.append(ourOpt);
        }

        $submit = $('input#stattr-js-event-submit', stDat.$main);
        $submit.click(function() {
            $slct = $('select#stattr-js-event-select', stDat.$main);
            ourId = $slct.val();
            stGet({id: $slct.val()}, 'event', eventPage);
            return 0;
        });
    }

    function adminPanel() {
        if (!stDat.isAdmin) {
            stDat.$error.html('You are not an admin!');
            return 0;
        }
        stLoad('admin');
        $('a#stattr-js-admin-events-create', stDat.$main).click(createEvent);
        $('a#stattr-js-admin-events-modify', stDat.$main).click(function() {
            if (!stDat.events)
                stGet({}, 'events', chooseEvent);
            else
                chooseEvent();
            return 0;
        });
        $('a#stattr-js-admin-users-create', stDat.$main).click(createUser);
        $('a#stattr-js-admin-users-modify', stDat.$main).click(function() {
            if (!stDat.users)
                stGet({}, 'users', chooseUser);
            else
                chooseUser();
            return 0;
        });
    }

    function inputTypes() {
	$this = $(this);
	type = $this.val();
	$fields = $this.closest('fieldset');
	$char = $('.stattr-js-char-validity', $fields);
	$val = $('.stattr-js-val-validity', $fields);
	switch (type) {
	    case 'bool':
		$val.hide();
		$char.hide();
		break;
	    case 'int':
	    case 'double':
		$val.show();
		$char.hide();
		break;
	    case 'varchar':
	    case 'text':
		$val.hide();
		$char.show();
		break;
	    default:
		$val.hide();
		$char.hide();
		break;
	}
    }

    function createEvent() {
        stLoad('eventcreate');
        $varRepeat = $('fieldset.stattr-js-variable-repeater', stDat.$main);
	$('.stattr-js-char-validity', $varRepeat).hide();
	$('.stattr-js-val-validity', $varRepeat).hide();
        $varHtml = $varRepeat.clone();
	$('.stattr-js-variable-type', $varRepeat).change(inputTypes);
	$('a.stattr-js-variable-remove', stDat.$main).click(function() {
		$(this).closest('fieldset').remove();
		return 0;
	    });
        $('a#stattr-js-variable-add', stDat.$main).click(function() {
	    $ourSet = $varHtml.clone();
	    $('.stattr-js-variable-type', $ourSet).change(inputTypes);
	    $('a.stattr-js-variable-remove', $ourSet).click(function() {
		$(this).closest('fieldset').remove();
		return 0;
	    });
	    $(this).before($ourSet);
	    return 0;
	});
	
        $('input#stattr-js-event-create-submit').click(function() {
            activity = $('input#stattr-js-event-create-activity', stDat.$main).val();
            officials = $('input#stattr-js-event-create-officials', stDat.$main).val().toLowerCase();
            descr = $('input#stattr-js-event-create-descr', stDat.$main).val();
            id = $('input#stattr-js-event-create-id', stDat.$main).val();
            variables = [];
            types = [];
	    regexes = [];
	    froms = [];
	    tos = [];
            $('fieldset.stattr-js-variable-repeater', stDat.$main).each(function() {
                $this = $(this);
		identifier = $('input.stattr-js-variable-id', $this).val();
                type = $('select.stattr-js-variable-type', $this).val();
		regex = $('input.stattr-js-char-validation', $this).val();
		from = $('input.stattr-js-val-validation-from', $this).val();
		to = $('input.stattr-js-val-validation-to', $this).val();
                variables.push(identifier);
                types.push(type);
		regexes.push(regex);
		froms.push(from);
		tos.push(to);
            });
            stPost({'id': id, 'descr': descr, 'activity': activity, 'officials': officials, 'variables': variables, 'types': types, 'regexes': regexes, 'from': froms, 'to': tos}, 'event', function(data) {
                if (data && !data.error) {
                    stDat.$error.html('Event created successfully.').delay(2000).empty();
                    stGet({}, 'events', homePage);
                }
                else
                    stDat.$error.html(data.error);
                return 0;
            });
        });
    }

    function createUser() {
        stLoad('usercreate');
        $('input#stattr-js-user-create-submit').click(function() {
            pw = $('input#stattr-js-user-create-password').val();
            if (pw != $('input#stattr-js-user-create-pwconf').val())
                stDat.$error.html('Passwords do not match!');
            else {
                formDat = {
                    'username': $('input#stattr-js-user-create-username').val().toLowerCase(),
                    'fullname': $('input#stattr-js-user-create-fullname').val(),
                    'profile': $('input#stattr-js-user-create-profile').val(),
                    'admin': $('input#stattr-js-user-create-admin').is(':checked'),
                    'password': Crypto.SHA1($('input#stattr-js-user-create-password').val())
                }
                stPost(formDat, 'user', function(data) {
                    if (data && !data.error) {
                        stDat.$error.html('User created successfully.').delay(2000).empty();
                        stGet({}, 'events', homePage);
			delete stDat.users;
                    }
                    else if (data && data.error)
                        stDat.$error.html(data.error);
                    else
                        stDat.$error.html('No response from server');
                    return 0;
                });
            }
        });
    }

    function chooseEvent(data) {
	if (data && data.events)
	    stDat.events = data.events;
	stLoad('eventchoose');

	$slct = $('select#stattr-js-event-choose-select', stDat.$main);
	if (!stDat.events[0] || stDat.events[0].id != ' ')
            stDat.events.unshift({id: ' ', activity: ' '});
	for (var i in stDat.events) {
            ourOpt = $('<option></option>');
            ourOpt.attr('value', stDat.events[i].id);
            ourOpt.html(stDat.events[i].activity);
            if (stDat.events[i].activity != ' ')
		ourOpt.append(': ' + stDat.events[i].descr);
            $slct.append(ourOpt);
	}

        $submit = $('input#stattr-js-event-choose-submit', stDat.$main);
	$submit.click(function() {
		$slct = $('select#stattr-js-event-choose-select', stDat.$main);
		ourId = $slct.val();
		stGet({id: $slct.val(), results: false}, 'event', modifyEvent);
		return 0;
	    });
    }

    function chooseUser(data) {
	if (data && data.users)
	    stDat.users = data.users;
	else if (data.error) {
	    stDat.$error.html(data.error);
	    return false;
	}
	stLoad('userchoose');

	$slct = $('select#stattr-js-user-choose-select', stDat.$main);
	if (!stDat.users[0] || stDat.users[0].username != ' ')
            stDat.users.unshift({username: ' ', fullname: ' '});
	for (var i in stDat.users) {
            ourOpt = $('<option></option>');
            ourOpt.attr('value', stDat.users[i].username);
            ourOpt.html(stDat.users[i].username);
	    if (stDat.users[i].username != ' ')
		ourOpt.append(' (' + stDat.users[i].fullname + ')')
            $slct.append(ourOpt);
	}

        $submit = $('input#stattr-js-user-choose-submit', stDat.$main);
	$submit.click(function() {
		$slct = $('select#stattr-js-user-choose-select', stDat.$main);
		ourId = $slct.val();
		stGet({username: $slct.val()}, 'user', modifyUser);
		return 0;
	    });
    }

    function modifyEvent(data) {
	stLoad('eventmodify');

	$('input#stattr-js-event-modify-activity').val(data.table.activity);
	var officials = '';
	for (var oi in data.table.officials)
	    officials += data.table.officials[oi] + ', ';
	officials = officials.slice(0, officials.length - 2);
	$('input#stattr-js-event-modify-officials').val(officials);
	$('input#stattr-js-event-modify-descr').val(data.table.descr);
	$('input#stattr-js-event-modify-id').val(data.table.id);

        $varRepeat = $('fieldset.stattr-js-variable-repeater', stDat.$main);
        $varHtml = $varRepeat.detach();
	for (var i in data.table.fields) {
	    if (data.table.fields[i] == 'participants')
		continue;
	    $ourClone = $varHtml.clone();
	    $('input.stattr-js-variable-id', $ourClone).val(data.table.fields[i]);
	    $('select.stattr-js-variable-type', $ourClone).val(data.table.types[i]);
	    $('.stattr-js-char-validity', $ourClone).hide();
	    $('.stattr-js-val-validity', $ourClone).hide();
	    $('.stattr-js-variable-type', $ourClone).change(inputTypes);
	    $('select.stattr-js-variable-type', $ourClone).change();
	    $('.stattr-js-char-validation', $ourClone).val(data.table.checks[i-1]);
	    $('.stattr-js-val-validation-from', $ourClone).val(data.table.rstarts[i-1]);
	    $('.stattr-js-val-validation-to', $ourClone).val(data.table.rends[i-1]);
	    $('a#stattr-js-variable-add').before($ourClone);
	    $('.stattr-js-variable-type', $ourClone).change(inputTypes);
	}

        $('a#stattr-js-variable-add', stDat.$main).click(function() {
	    $ourSet = $varHtml.clone();
	    $('.stattr-js-variable-type', $ourSet).change(inputTypes);
	    $('a.stattr-js-variable-remove', $ourSet).click(function() {
		$(this).closest('fieldset').remove();
		return 0;
	    });
	    $(this).before($ourSet);
	    return 0;
	});

	$('a.stattr-js-variable-remove', stDat.$main).click(function() {
		$(this).closest('fieldset').remove();
		return 0;
	    });

        $('input#stattr-js-event-modify-submit').click(function() {
            activity = $('input#stattr-js-event-modify-activity', stDat.$main).val();
            officials = $('input#stattr-js-event-modify-officials', stDat.$main).val().toLowerCase();
            descr = $('input#stattr-js-event-modify-descr', stDat.$main).val();
            id = $('input#stattr-js-event-modify-id', stDat.$main).val();
            variables = [];
            types = [];
	    regexes = [];
	    froms = [];
	    tos = [];
            $('fieldset.stattr-js-variable-repeater', stDat.$main).each(function() {
                identifier = $('input.stattr-js-variable-id', $(this)).val();
                type = $('select.stattr-js-variable-type', $(this)).val();
		regex = $('input.stattr-js-char-validation', $this).val();
		from = $('input.stattr-js-val-validation-from', $this).val();
		to = $('input.stattr-js-val-validation-to', $this).val();
                variables.push(identifier);
                types.push(type);
		regexes.push(regex);
		froms.push(from);
		tos.push(to);
            });
            stPut({'oldid': data.table.id, 'id': id, 'descr': descr, 'activity': activity, 'officials': officials, 'variables': variables, 'types': types, 'regexes': regexes, 'from': froms, 'to': tos}, 'event', function(data) {
                if (data && !data.error) {
                    stDat.$error.html('Event updated successfully.').delay(2000).empty();
                    stGet({}, 'events', chooseEvent);
                }
                else
                    stDat.$error.html(data.error);
                return 0;
            });
        });
    }

    function modifyUser(data) {
	stLoad('usermodify');

	$username = $('input#stattr-js-user-modify-username', stDat.$main);
	$fullname = $('input#stattr-js-user-modify-fullname', stDat.$main);
	$profile = $('input#stattr-js-user-modify-profile', stDat.$main);
	$admin = $('input#stattr-js-user-modify-admin', stDat.$main);

	$username.val(data.username);
	$fullname.val(data.fullname);
	$profile.val(data.profile);
	$admin.attr('checked', (data.admin == '1'));

        $('input#stattr-js-user-modify-submit').click(function() {
		pw = $('input#stattr-js-user-modify-password').val();
		if (pw != '' && pw != $('input#stattr-js-user-modify-pwconf').val())
		    stDat.$error.html('Passwords do not match!');
		else {
		    formDat = {
			'olduser': data.username,
			'username': $username.val(),
			'fullname': $fullname.val(),
			'profile': $profile.val(),
			'admin': $admin.is(':checked')
		    }
		    if (pw)
			formDat.password = Crypto.SHA1(pw);
		    stPut(formDat, 'user', function(data) {
			    if (data && !data.error) {
				stDat.$error.html('User created successfully.').delay(2000).empty();
				stGet({}, 'users', chooseUser);
			    }
			    else if (data && data.error)
				stDat.$error.html(data.error);
			    else
				stDat.$error.html('No response from server');
			    return 0;
			});
		}
	    });

    }

    function eventPage(data) {
        stLoad('eventhome');

        if (!stDat.eventsList)
            stDat.eventsList = {};

        stDat.eventsList[data.table.id] = data.table;

        $('p#stattr-js-event-home-activity', stDat.$main).html(data.table[1]);
        $('p#stattr-js-event-home-descr', stDat.$main).html(data.table[2]);

	var fieldstats = {};
	for (var h in data.events) {
	    for (var i in data.events[h]) {
		if (i == 'participants')
		    continue;
		var thisfield = data.events[h][i];
		if (!fieldstats[i])
		    fieldstats[i] = {};

		var thistype = data.table.types[data.table.fields.indexOf(i)];

		if (thistype == 'int' || thistype == 'double') {
		    if (!fieldstats[i].total) {
			fieldstats[i].total = 0;
			fieldstats[i].order = [];
			fieldstats[i].partics = [];
		    }
		    for (var j in thisfield) {
			fieldstats[i].total += thisfield[j];
			var cur = fieldstats[i].order.length / 2;
			cur -= cur % 1;
			var change = cur / 2;
			change -= change % 1;
			while (1) {
			    if (fieldstats[i].order[cur] > thisfield[j])
				cur -= change;
			    else if (fieldstats[i].order[cur] < thisfield[j])
				cur += change;
			    else
				change = 0;
			    if (change / 2 >= 1) {
				change /= 2;
				change -= change % 1;
			    }
			    else {
				if (fieldstats[i].order[cur] > thisfield[j]) {
				    fieldstats[i].order.splice(cur, 0, thisfield[j]);
				    fieldstats[i].partics.splice(cur, 0, data.events[h].participants[j]);
				}
				else {
				    fieldstats[i].order.splice(cur+1, 0, thisfield[j]);
				    fieldstats[i].partics.splice(cur+1, 0, data.events[h].participants[j]);
				}
				break;
			    }
			}
		    }
		}
		else if (thistype == 'bool') {
		    if (!fieldstats[i].truth) {
			fieldstats[i].truth = 0;
			fieldstats[i].falsity = 0;
		    }
		    for (var k in thisfield) {
			if (thisfield[k] === true)
			    fieldstats[i].truth++;
			else
			    fieldstats[i].falsity++;
		    }
		}
		else if (thistype == 'text' || thistype == 'varchar') {
		    if (!fieldstats[i].occurrences) {
			fieldstats[i].indices = {};
			fieldstats[i].occurrences = {};
			fieldstats[i].order = [];
		    }
		    for (var l in thisfield) {
			index = Crypto.SHA1(thisfield[l]);
			if (!fieldstats[i].occurrences[index]) {
			    fieldstats[i].occurrences[index] = 1;
			    fieldstats[i].indices[index] = thisfield[l];
			}
			else
			    fieldstats[i].occurrences[index]++;
		    }
		}
	    }
	}
	$fieldCloner = $('.stattr-js-event-stat-repeater', stDat.$main).detach();
	for (var m in fieldstats) {
	    $thisClone = $fieldCloner.clone();
	    $('.stattr-js-event-stat-header', $thisClone).html(m);
	    $middle = $('.stattr-js-event-stat-repeater-average', $thisClone);
	    $high = $('.stattr-js-event-stat-repeater-high', $thisClone);
	    $low = $('.stattr-js-event-stat-repeater-low', $thisClone);
	    thistype = data.table.types[data.table.fields.indexOf(m)];
	    if (thistype == 'int' || thistype == 'double') {
		fieldstats[m].mean = fieldstats[m].total / fieldstats[m].order.length;
		length = fieldstats[m].order.length;
		medpos = length / 2;
		if (medpos % 1 != 0)
		    fieldstats[m].median = (fieldstats[m].order[medpos - (medpos % 1)] + fieldstats[m].order[medpos + (1 - (medpos % 1))]) / 2;
		else
		    fieldstats[m].median = fieldstats[m].order[medpos];
		$middle.html("Mean: " + fieldstats[m].mean + "<br />Median: " + fieldstats[m].median);
		$low.html("Low: " + fieldstats[m].order[0] + '<br />By: ');
		$low.append(makeUserLink(fieldstats[m].partics[0]));
		$high.html("High: " + fieldstats[m].order[length - 1] + '<br /> By: ');
		$high.append(makeUserLink(fieldstats[m].partics[length - 1]));
	    }
	    else if (thistype == 'text' || thistype == 'varchar') {
		for (var occurrence in fieldstats[m].occurrences) {
		    cur = fieldstats[m].order.length / 2;
		    cur -= cur % 1;
		    change = cur / 2;
		    change -= change % 1;
		    while (1) {
			if (fieldstats[m].occurrences[fieldstats[m].order[cur]] > fieldstats[m].occurrences[occurrence])
			    cur -= change;
			else if (fieldstats[m].occurrences[fieldstats[m].order[cur]] < fieldstats[m].occurrences[occurrence])
			    cur += change;
			else
			    change = 0;
			if (change / 2 >= 1) {
			    change /= 2;
			    change -= change % 1;
			}
			else {
			    if (fieldstats[m].occurrences[fieldstats[m].order[cur]] > fieldstats[m].occurrences[occurrence])
				fieldstats[m].order.splice(cur, 0, occurrence);
			    else
				fieldstats[m].order.splice(cur+1, 0, occurrence);
			    break;
			}
		    }
		}
		$middle.remove();
		$high.html('Most frequent:<br />' + fieldstats[m].indices[fieldstats[m].order[fieldstats[m].order.length-1]]);
		$low.html('Least frequent:<br />' + fieldstats[m].indices[fieldstats[m].order[0]]);
		$high.attr('colspan', 2);
	    }
	    else if (thistype == 'bool') {
		$middle.remove();
		truthiness = 100 * (fieldstats[m].truth / (fieldstats[m].truth + fieldstats[m].falsity));
		falsiness = 100 - truthiness;
		$high.html('True ' + truthiness + '% of the time');
		$low.html('False ' + falsiness + '% of the time');
	    }
	    $('#stattr-js-event-stats', stDat.$main).append($thisClone);
	}

        var moderate = false;

        for (var n in data.table.officials) {
            if (stDat.username && stDat.username == data.table.officials[n]) {
                moderate = true;
                break;
            }
        }

        if (moderate)
            $('input#stattr-js-add-results', stDat.$main).click(function() {
                resultsAdd(data.table.id);
                return 0;
            });
        else
            $('input#stattr-js-add-results', stDat.$main).remove();

        $varClone = $('th.stattr-js-event-home-variable-repeater', stDat.$main).detach();
        $resultTable = $('table.stattr-js-event-home-results-table', stDat.$main).detach();
	delete h;
        for (var h in data.events) {
	    fieldList = [];
	    boolList = [];
	    for (var field in data.events[h]) {
		if (data.table.types[data.table.fields.indexOf(field)] == 'bool')
		    boolList.push(field);
		else
		    fieldList.push(field);
	    }
            $ourTable = $resultTable.clone();
            $eventClone = $('tr.stattr-js-event-home-result-repeater', $ourTable).detach();
	    delete i;
	    for (var i in fieldList) {
		$ourTr = $eventClone.clone();
		$resClone = $('td.stattr-js-event-home-variable-repeatee', $ourTr).detach();
		$ourTd = $varClone.clone();
		$ourTd.html(fieldList[i]);
		$ourTr.append($ourTd);
		delete j;
		for (var j in data.events[h][fieldList[i]]) {
		    $ourTd = $resClone.clone();
		    if (fieldList[i] == 'participants')
			$ourTd.html(makeUserLink(data.events[h][fieldList[i]][j]));
		    else
			$ourTd.html(data.events[h][fieldList[i]][j]);
		    $ourTr.append($ourTd);
		}
		$ourTable.append($ourTr);
            }
	    delete i;
	    for (var i in boolList) {
		$ourTr = $eventClone.clone();
		$resClone = $('td.stattr-js-event-home-variable-repeatee', $ourTr).detach();
		$ourTd = $varClone.clone();
		$ourTd.html(boolList[i]);
		$ourTr.append($ourTd);
		$ourTd = $resClone.clone();
		$ourTd.attr('colspan', data.events[h].participants.length);
		delete j;
		for (var j in data.events[h].participants) {
		    if (data.events[h][boolList[i]][j] === true) {
			$ourTd.append(makeUserLink(data.events[h].participants[j]));
			$ourTd.append(', ');
		    }
		}
		tdStr = $ourTd.html();
		$ourTd.html(tdStr.slice(0, tdStr.length-2));
		$ourTr.append($ourTd);
		$ourTable.append($ourTr);
	    }
            stDat.$main.append($ourTable);
        }
    }

    function resultsAdd(eventId) {
	function handleChange($inputele, eventinfo) { // Still inside of resultsAdd
	    if ($inputele.attr('class') == 'stattr-js-competitor-name')
		return true;
	    value = $inputele.val();
	    field = eventinfo.fields.indexOf($('span.stattr-js-variable-name', $inputele.closest('p.stattr-js-variable-repeater')).html());
	    var typeregex = false;
	    switch (eventinfo.types[field]) {
		case 'bool':
		    return true;
		    break;
		case 'int':
		    typeregex = /[^0-9\-]/;
		    break;
		case 'double':
		    typeregex = /[^0-9.\-]/;
		    break;
		case 'varchar':
		case 'text':
		    typeregex = /[\*\"\']/;
		    break;
		default:
		    typeregex = false;
	    }
	    if (typeregex && typeregex.test(value)) {
		stDat.$error.html('Error: Invalid characters for this type in input string');
		window.setTimeout(function() {
		    stDat.$error.empty();
		}, 5000);
		return false;
	    }
	    if (eventinfo.checks && eventinfo.checks[field-1] && eventinfo.checks[field-1] != '') {
		customregex = eval(eventinfo.checks[field-1]);
		if (typeof customregex.test != "function") {
		    stDat.$error.html('Error: Regex is not regex, unsafe to continue.');
		    window.setTimeout(function() {
			stDat.$error.empty();
		    }, 5000);
		    return false;
		}
		if (customregex.test(value)) {
		    stDat.$error.html('Error: Invalid characters in input string');
		    window.setTimeout(function() {
			stDat.$error.empty();
		    }, 5000);
		    return false;
		}
	    }
	    if (eventinfo.rstarts && eventinfo.rstarts[field-1] && eventinfo.rstarts[field-1] != '') {
		if (parseFloat(value) < parseFloat(eventinfo.rstarts[field-1])) {
		    stDat.$error.html('Error: Value too low');
		    window.setTimeout(function() {
			stDat.$error.empty();
		    }, 5000);
		    return false;
		}
	    }
	    if (eventinfo.rends && eventinfo.rends[field-1] && eventinfo.rends[field-1] != '') {
		if (parseFloat(value) > parseFloat(eventinfo.rends[field-1])) {
		    stDat.$error.html('Error: Value too high');
		    window.setTimeout(function() {
			stDat.$error.empty();
		    }, 5000);
		    return false;
		}
	    }
	    return true;
	}

        stLoad('resultsadd');

        $('span#stattr-js-results-event-name', stDat.$main).html(stDat.eventsList[eventId].activity + ': ' + stDat.eventsList[eventId].descr);

	$compet = $('fieldset.stattr-js-competitor-repeater', stDat.$main);
	$varRe = $('p.stattr-js-variable-repeater', $compet).detach();

	for (var i in stDat.eventsList[eventId].fields) {
	    if (i > 0) {
		$thisVar = $varRe.clone();
		$('span.stattr-js-variable-name', $thisVar).html(stDat.eventsList[eventId].fields[i]);
		$thisVal = $('input.stattr-js-variable-value', $thisVar);
		if (stDat.eventsList[eventId].types[i] == 'bool') {
		    $thisVal.replaceWith($thisVal.clone().attr('type', 'checkbox'));
		}
		else if (stDat.eventsList[eventId].types[i] == 'text') {
		    $thisVal.replaceWith(document.createElement('textarea'));
		    $thisVal = $('textarea', $thisVar);
		    $thisVal.addClass('.stattr-js-variable-value');
		}
		else {
		    $thisVal.replaceWith($thisVal.clone().attr('type', 'text'));
		}
		$compet.append($thisVar);
	    }
	}

	function respondToChange() {
	    if (handleChange($(this), stDat.eventsList[eventId]))
		stDat.$submit.removeAttr('disabled');
	    else
		stDat.$submit.attr('disabled', 'disabled');
	}
	
	$compRe = $compet.clone();
	stDat.$submit = $('input#stattr-js-results-submit', stDat.$main);
	
	$('input', stDat.$main).change(respondToChange);
	$('textarea', stDat.$main).change(respondToChange);
	
	$('a#stattr-js-results-add-competitor', stDat.$main).click(function() {
	    $compRe.clone().insertBefore($(this));
	});

	stDat.$submit.click(function() {
	    results = [];
		for (var i in stDat.eventsList[eventId].fields) {
		    results.push([]);
		}
		$('input.stattr-js-competitor-name', stDat.$main).each(function() {
			$this = $(this);
			results[0].push($this.val().toLowerCase());
			$('input.stattr-js-variable-value', $this.parent().parent()).each(function(index) {
				if ($(this).attr('type') == 'checkbox')
				    results[index+1].push($(this).is(':checked'));
				else
				    results[index+1].push($(this).val());
			    });
		    });
		stPost({'event': eventId, 'results': results}, 'results', function(data) {
			if (data && !data.error)
			    homePage();
			
			else if (data && data.error)
			    stDat.$error.html(data.error);
			
			else
			    stDat.$error.html('No response from server, wtf?');
		});
	});
    }

    function userProfile(data) {
	stLoad('profile');
	$userP = $('#stattr-js-user-name', stDat.$main);
	$userP.html(data.user.username);
	$boolRow = $('.stattr-js-bool-row', stDat.$main).detach();
	$numRow = $('.stattr-js-number-row', stDat.$main).detach();
	$strRow = $('.stattr-js-string-row', stDat.$main).detach();
	$evSet = $('.stattr-js-user-event', stDat.$main).detach();
	for (var event in data.results) {
	    $thisSet = $evSet.clone();
	    $thisTable = $('.stattr-js-stats-table', $thisSet);
	    $('.stattr-js-event-title', $thisSet).html(data.events[event].activity);
	    $('.stattr-js-event-descr', $thisSet).html(data.events[event].descr);
	    for (var field in data.events[event].fields) {
		var $thisRow = null;
		thisType = data.events[event].types[field];
		thisName = data.events[event].fields[field];
		if (thisName == 'participants') {
		    continue;
		}
		else if (thisType == 'bool') {
		    $thisRow = $boolRow.clone();
		    $('.stattr-js-var-name', $thisRow).html(thisName);
		    count = 0;
		    for (var i in data.results[event]) {
			thisResult = data.results[event][i];
			if (thisResult[thisName][thisResult.participants.indexOf(data.user.username)])
			    count++;
		    }
		    truePercent = count / data.results[event].length * 100;
		    $('.stattr-js-true-percent', $thisRow).html('True ' + truePercent + '% of the time');
		    $('.stattr-js-false-percent', $thisRow).html('False ' + (100 - truePercent) + '% of the time');
		}
		else if (thisType == 'int' || thisType == 'double') {
		    $thisRow = $numRow.clone();
		    $('.stattr-js-var-name', $thisRow).html(thisName);
		    sortedList = [];
		    total = 0;
		    var median, mean;
		    for (i in data.results[event]) {
			thisResult = data.results[event][i];
			number = thisResult[thisName][thisResult.participants.indexOf(data.user.username)];
			total += number;
			attempt = sortedList.length / 2;
			attempt -= attempt % 1;
			change = attempt / 2;
			change -= change % 1;
			while (1) {
			    if (sortedList[attempt] > number)
				attempt -= change;
			    else if (sortedList[attempt] < number)
				attempt += change;
			    else
				change = 0;
			    if (change / 2 >= 1) {
				change /= 2;
				change -= change % 1;
			    }
			    else {
				if (sortedList[attempt] > number)
				    sortedList.splice(attempt, 0, number);
				else
				    sortedList.splice(attempt+1, 0, number);
				break;
			    }
			}
		    }
		    if (sortedList.length % 2)
			median = sortedList[(sortedList.length - 1) / 2];
		    else {
			center = (sortedList.length - 1) / 2;
			median = (sortedList[center - 0.5] + sortedList[center + 0.5]) / 2;
		    }
		    $('.stattr-js-mean', $thisRow).html('Mean:<br />' + (total / sortedList.length));
		    $('.stattr-js-median', $thisRow).html('Median:<br />' + median);
		}
		else if (thisType == 'varchar' || thisType == 'text') {
		    $thisRow = $strRow.clone();
		    $('.stattr-js-var-name', $thisRow).html(thisName);
		    occurrences = {};
		    order = [];
		    for (i in data.results[event]) {
			thisResult = data.results[event][i];
			thisStr = thisResult[thisName][thisResult.participants.indexOf(data.user.username)];
			if (!occurrences[thisStr])
			    occurrences[thisStr] = 1;
			else
			    occurrences[thisStr]++;
		    }
		    for (i in occurrences) {
			j = 0;
			while (order[j] && occurrences[i] > occurrences[order[j]])
			    j++;
			if (j >= order.length)
			    order.push(i);
			else
			    order.splice(j, 0, i);
		    }
		    $('.stattr-js-most-occurring', $thisRow).html('Most occurrences:<br />' + order[order.length - 1]);
		    $('.stattr-js-least-occurring', $thisRow).html('Fewest occurrences:<br />' + order[0]);
		}
		if ($thisRow && $thisRow.length)
		    $thisTable.append($thisRow);
	    }
	    $userP.after($thisSet);
	}
    }
}
