
// FOR NODEJS ONLY >>>>>>>>>>>
	
	var sys = require("sys");
	var http = require("http");
	var url = require("url");
	var events = require("events");
	var xmpp = require("../lib/node-xmpp/lib/node-xmpp");
	
// FOR NODEJS ONLY <<<<<<<<<<<

	var constraints = {};
	var v_names = new Array();
	var v_values = new Array();
	var backtrack = undefined;
	var okcs = new Array();
//	var clauses = new Array();
	var role_heads = new Array();
	var role_bodies = new Array();
	var init = undefined;
	var currentMessageNode = undefined;
	var currentRoleNode = undefined;
	var currentConstraintsNode = undefined;
	var nextThenNode = undefined;
	var nextOrNode = undefined;
	var peerFullID = undefined;
	var peerPassword = undefined;
	var client = undefined;
	var xmpp_resource = undefined;
	var lastest_offline_msg = undefined;
	var niob_counter = undefined;
	var emitter = new events.EventEmitter;
	emitter.removeAllListeners("okcs loaded");
	emitter.removeAllListeners("gotMessageFromXMPPServer");
	emitter.on("gotMessageFromXMPPServer", onMessageArrival);
	
	var test_begin = undefined;
	var test_end = undefined;
	
	var NODE_OP			= 1;
	var NODE_VAR 		= 2;
	var NODE_CONST		= 3;
	var NODE_ARR		= 4;
	
	var OP_ENTRY		= -2;
	var OP_NONE 		= -1;
	var OP_SEND 		= 0;
	var OP_RECEIVE		= 1;
	var OP_THEN			= 2;
	var OP_OR			= 3;
	var OP_LIST 		= 4;
	var OP_ROLE			= 5;
	var OP_ROLE_DEF		= 6;
	var OP_SEND 		= 7;
	var OP_RECEIVE		= 8;
	var OP_ROLE_TYPE    = 9;
	var OP_SET_VAR      = 10;
	var OP_CONSTRAINT	= 11;
	var OP_NEGATE		= 12;
	var OP_LOGAND		= 13;
	var OP_LOGOR		= 14;
	var OP_NO_MSG		= 15;
	var OP_TERMS		= 16;
	var OP_FACTOR		= 17;
	var OP_MESSAGE		= 18;
	var OP_HEADBODY		= 19;
	var OP_ROLE_CHANGE  = 20;
	var OP_PAR			= 21;
	var OP_KNOWS		= 22;
	var OP_PLAYS		= 23;
	var OP_IID			= 24;
	var OP_CLAUSE		= 25;
	var OP_NIOB			= 26;
	var OP_BRACKET		= 27;
	var OP_BRACKET_OR	= 28;
	var OP_EQU			= 29;
	var OP_NEQ			= 30;
	var OP_GRT			= 31;
	var OP_LOT			= 32;
	var OP_GRE			= 33;
	var OP_LOE			= 34;
	var OP_ASSIGN		= 35;

/*  previous user input reader

	process.stdin.resume();
	read_string = function(){
		var stdIn = {
			start : "",
			data : ""
		};
		process.stdin.resume();
		process.stdin.removeAllListeners();
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", function (chunk) {
			stdIn.start = chunk;
			process.stdout.write("You just inputed : " + chunk);
			process.stdin.resume(); });
//		while(stdIn.start==""){};
		process.stdin.pause();
		var data = stdIn.start;
		stdIn.start = "";
//		sys.debug("before return");
		return data;
	};
	process.stdin.pause();
*/
	
	var read_string_exec = false, read_string_node = false;
  	
	var read_string = function(fn){
//		sys.debug("inside the read_string function");
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', function (chunk) {
		 	fn(chunk);
		 	process.stdin.pause();
		});
	};
	
	function Node(){
		var type;
		var value;
		var children;
	} 
		
	function createNode(type, value, childs){
		var n = new Node();
		n.type = type;
		n.value = value;
		n.children = new Array();
		
		for(var i = 2; i < arguments.length; i++){
			n.children.push(arguments[i]);
		}
		return n;
	}
	
	function setValue(vname, vvalue){
		var found = false;
		for(var i = 0; i < v_names.length; i++){
			if(v_names[i].toString() == vname.toString()){
				v_values[i] = (arguments.length == 1)? undefined : vvalue; //The type is now checked here.
				found = true;
				break;
			}
			
		}
		if(!found){
			v_names.push(vname);
			v_values.push((arguments.length == 1)? undefined : vvalue);
		}
	}
	
	function getValue(vname){
		for(var i = 0; i < v_names.length; i++){
			if(v_names[i].toString() == vname.toString()){
				return v_values[i];
			}
		}
		return undefined;
	}

	function prepareVariableList(factors){
		var variable_list = [];
		if(factors.length != 0){
			for(var i = 0; i < factors.length; i++){
				if(factors[i].name && factors[i].name.charAt(0) === factors[i].name.charAt(0).toUpperCase()){
					if(!factors[i].value || factors[i].value == undefined || factors[i].value == "undefined" ){
						variable_list.push(factors[i].name);
					}
				}
				if(factors[i].params && factors[i].params.length != 0){
					variable_list = variable_list.concat(prepareVariableList(factors[i].params));
				}
			}
		}
		return variable_list;
	}
	
	function getUndefinedList(factors){
		return prepareVariableList(factors);
	}
	
	function setUndefinedList(variable_list, value_list){
		if(variable_list.length == value_list.length){
			for(var i = 0; i < variable_list.length; i++){
				setValue(variable_list[i], value_list[i]);
			}
			return true;
		}
		else{
			return false;
		}
	}


/*	commented out due to the do-not-blocking-the-event-loop requirement by node.js
*/
	function buildVariableList(variable_list, loop_counter, callback){
		if(variable_list.length != 0){
			process.stdin.resume();
			process.stdout.write("Please assign a new value to variable '" + variable_list[loop_counter] + "':");
			process.stdin.setEncoding("utf8");
			
			process.stdin.once("data", function (fvalue) {
				fvalue = fvalue.toString().trim();
				setValue(variable_list[loop_counter], fvalue);
			});
			process.stdin.on("end", function () {
				loop_counter++;
				if(loop_counter == variable_list.length){
					callback();
				}
				else{
					buildVariableList(variable_list, loop_counter, callback);
				}
			});
		}
	}

	
/*	commented out due to the do-not-blocking-the-event-loop requirement by node.js

	function buildVariableList(variable_list, callback){
		if(variable_list.length != 0){
			prompt.start();
//			prompt.get(variable_list, function(err, result){
			prompt.get(["A", "B", "C"], function(err, result){
//				sys.debug(JSON.stringify(result));
				callback();
			});
		}
	}
*/
	
/*  commented out due to the do-not-blocking-the-event-loop requirement by node.js
*/
	function readValueAsync(factors, callback1){
		var variable_list = prepareVariableList(factors);
		buildVariableList(variable_list, 0, function(){
			process.exit();
			callback1();		
		});
	}


	function readValue(factors){
		if(factors.length != 0){
			for(var i = 0; i < factors.length; i++){
				if(factors[i].name && factors[i].name.charAt(0) === factors[i].name.charAt(0).toUpperCase()){
					if(!factors[i].value || factors[i].value == undefined || factors[i].value == "undefined" ){
						reading_string_exec = true;
//						sys.debug("Please assign a new value to variable '" + factors[i].name + "(" + factors[i].value + ")':");
//						var fvalue = read_string();
						read_string(function(val){
							if(i == factors.length && !(factors[i].params && factors[i].params.length != 0)) 
								reading_string_exec = false; 
								factors[i].value = val; 
								setValue(factors[i].name, val);});
//						factors[i].value = fvalue;
//						setValue(factors[i].name, fvalue);
					}
				}
				if(factors[i].params && factors[i].params.length != 0){
					readValue(factors[i].params);
				}
			}
		}
	}

	
	function serialiseValue(factors){
		var content = "";
		for(var i = 0; i < factors.length; i++){
//			sys.debug(factors[i].name.charAt(0).toString() + " : " + factors[i].name.charAt(0).toString().toUpperCase());
			if(factors[i].name && factors[i].name.charAt(0).toString() == factors[i].name.charAt(0).toString().toUpperCase()){
				if(factors[i].value == undefined){
//					sys.debug("here again");
				}
				else{
//					sys.debug(JSON.stringify(factors[i]));
//					sys.debug("detect factors " + factors[i].name + " " + factors[i].value);
					content += factors[i].name + " : " + factors[i].value + "\r\n";
					
				}
			}
			if(factors[i].params && factors[i].params.length != 0){
				content += serialiseValue(factors[i].params);
			}
		}
		return content;
	}
	
	function displayValue(factors){
		sys.debug(serialiseValue(factors));
	}
	
	function print(str){
		sys.print(str);
	}
	
	function println(str){
		sys.puts(str);
	}
	
	var peerHelper = { 
		"setValue" : setValue, 
		"getValue" : getValue,
		"readValue" : readValue,	  // commented out due to the do-not-blocking-the-event-loop requirement by node.js
		"readValueAsync" : readValueAsync,
		"setUndefinedList" : setUndefinedList,
		"getUndefinedList" : getUndefinedList, 		
		"print" : print,
		"println" : println,
		"displayValue" : displayValue
	}
	
	function resetLCCEnvironment(){
		v_names = new Array();
		v_values = new Array();
		backtrack = undefined;
		okcs = new Array();
		clauses = new Array();
		role_heads = new Array();
		role_bodies = new Array();
		init = undefined;
		currentMessageNode = undefined;
		currentRoleNode = undefined;
		currentConstraintsNode = undefined;
		nextThenNode = undefined;
		nextOrNode = undefined;
		niob_counter = undefined;
	}
	
	function removeQuotes(str){
		if(str.charAt(0) == '\'' || str.charAt(0) == '\"')
			return str.substring(1, str.length - 1);
		else
			return str;
	}
	
	function isIdenticalRole(tnode1, tnode2, recursion_counter){ //TODO need testing
//		sys.debug(recursion_counter + " : "+ JSON.stringify(tnode1) + " " + JSON.stringify(tnode2));
		if(typeof(tnode1) == "string" && typeof(tnode2) == "string"){
			if(recursion_counter < 4){
				if(tnode1 == tnode2){
					return true;
				}
				else{
					return false;
				}
			}
			else{
				return true;
			}	
		}
		else if(typeof(tnode1) == "string" && typeof(tnode2) != "string" || typeof(tnode1) != "string" && typeof(tnode2) == "string"){
			return false;
		}
		else{
			recursion_counter++;
			if((tnode1.type == 1 && tnode1.type.toString() == tnode2.type.toString() && tnode1.value.toString() == tnode2.value.toString())
			|| (tnode1.type != 1 && tnode1.type.toString() == tnode2.type.toString())){
				if(tnode1.children.length == 0 && tnode2.children.length == 0){
						return true;
				}
				else if(tnode1.children.length == tnode2.children.length){
					for(var i = 0; i < tnode1.children.length; i++){
						if(isIdenticalRole(tnode1.children[i], tnode2.children[i], recursion_counter)){
							continue;
						}
						else{
//							sys.debug("detect false here");
							return false;
						}
					}
					return true;
				}
				else{
//					sys.debug("different children lengths");
					return false;
				}
			}
			else{
//				sys.debug("different types or values");
				return false;
			}
		}
	}

	
	function updateVariableValueInNode(src_role_head, dest_role_head){
		if(typeof(src_role_head) == "string" && typeof(dest_role_head) == "string"){
			if(getValue(src_role_head)){
				setValue(dest_role_head, getValue(src_role_head));
			}
			else{
				setValue(dest_role_head, src_role_head);
			}
		}
		else{
			for(var i = 0; i < src_role_head.children.length; i++){
				updateVariableValueInNode(src_role_head.children[i], dest_role_head.children[i]);
			}
		}
	}
	
	function getRoleBodyByRoleHead(role_head){
		var role_body = null;
		for(var i = 0; i < role_heads.length; i++){
			if(isIdenticalRole(role_head, role_heads[i], 0)){
				role_body = role_bodies[i];
				break;
			}
		}
		if(role_body == null){
			throw roleDefinitionNotFoundException(JSON.stringify(role_head));
		}
		else{
//			sys.debug("find the role definition!");
		}
		return role_body;
	}
	
	function getRoleBodyByRoleHeadAfterRoleChanging(role_head){
//		sys.debug("role_head " + JSON.stringify(role_head));
		var role_body = null;
//		sys.debug("number of pairs of heads and bodies: " + role_heads.length);
		for(var i = 0; i < role_heads.length; i++){
//			sys.debug(JSON.stringify(role_head) + "================" + JSON.stringify(role_heads[i]));
			if(isIdenticalRole(role_head, role_heads[i], 0)){
//				sys.debug("find identical roles");
				updateVariableValueInNode(role_head, role_heads[i]);
				role_body = role_bodies[i];
				break;
			}
		}
		if(role_body == null){
			throw roleDefinitionNotFoundException(JSON.stringify(role_head));
		}
		else{
//			sys.debug("find the role definition!");
		}
		return role_body;
	}
	
	function getRoleNameByRoleHeadNode(role_head){
		return role_head.children[0].children[0].toString();
	}
	
	function retrieveOKCs(okcs, count, length, node){
	 	var url_obj = url.parse(okcs[count]);
		var options = {
			host: url_obj.hostname,
			port: url_obj.port,
			path: url_obj.pathname,
			method: "GET"
		};
		sys.debug(JSON.stringify(options));
		var request = http.request(options, function(res) {
//			res.setEncoding("utf8");
			res.on("data", function(chunk){
//				sys.debug(chunk);
				eval.call(null, chunk.toString());
				sys.debug("OKC [" + okcs[count] + "] loaded!");
				count++;
				if(count == length){
					sys.debug("OKCs loading finished!");
//					sys.debug(JSON.stringify(node));
					emitter.emit("okcs loaded", node);
				}
				else{
					retrieveOKCs(okcs, count, length, node);
				}
			}).on("end", function(){
				sys.debug("okc loaded");
			});
		}).on("error", function(e) {
			sys.debug("okc loading error: " + e.message);
		}).end();
	}
	
	function initialize(clauses, builtIns){
		test_begin = (new Date()).getTime();
		init = new Array();
		okcs = new Array();
		niob_counter = 1;
		execute(builtIns);
		var j = new xmpp.JID(process.argv[3]);
		j.resource = xmpp_resource;
		peerFullID =  j.toString();
		peerPassword = process.argv[4];
		sys.debug(peerFullID);
//		sys.debug(JSON.stringify({jid : peerFullID, password : peerPassword, host : j.domain, port : 5222}));
		client = new xmpp.Client({jid : peerFullID, password : peerPassword});
		client.on("online", function(){
//			sys.debug(new xmpp.Element("presence", { to : "test" }).c("priority"));
			client.send(new xmpp.Element("presence", { from : peerFullID }).c("priority").t("1"));
			sys.debug("Connected to the XMPP server!");
//			sys.debug("Start interpreting the codes");
			emitter.on("okcs loaded", execute);
//			sys.debug(init[0].jid.toString());
			for(var i = 0; i < init.length; i++){
//				if(init[i].iid){
//					xmpp_resource = init[i].iid.toString();
//					sys.debug("Interaction ID is " + xmpp_resource);
//				}
				if(init[i].okcs){
					for(var j = 0; j < init[i].okcs.length; j++){
						okcs.push(init[i].okcs[j]);
//						sys.debug(init[i].okcs[j]);
					}
				}
			}
			var count = 0;
			var length = okcs.length;
//			sys.debug("length: " + JSON.stringify(okcs));
			retrieveOKCs(okcs, count, length, clauses);
		});
		client.on("stanza", function(stanza) {
//			sys.debug("get stanza :" + stanza);
//			sys.debug("to: " + stanza.attrs.to);
//			sys.debug("from: " + stanza.attrs.from);
  			if (stanza.is("message") && stanza.attrs.type && 
  				stanza.attrs.type == "chat" && stanza.attrs.from.indexOf("/") != -1 &&
  				(new xmpp.JID(stanza.attrs.from)).resource == xmpp_resource) {
  				if(stanza.attrs.to == peerFullID){
	  				var body = stanza.getChildren("body")[0].getText();
					emitter.emit("gotMessageFromXMPPServer", {"from" : stanza.attrs.from, "body" : body});
  				}
  			}
        });
		client.on("error", function(e){
			sys.debug(e);
			process.exit(1);
		});
	}
	
/* 	is not needed on the server side

	function initializeByHeader(jsonStr, clauses, builtIns){
		niob_counter = 1;
//		sys.debug("Start interpreting the codes");
		emitter.on("okcs loaded", execute);
//		sys.debug("node " + JSON.stringify(clauses, null, "\t"));
		init = eval('(' + jsonStr + ')');
//		sys.debug(init[0].jid.toString());
		for(var i = 0; i < init.length; i++){
			if(init[i].iid){
				xmpp_resource = init[i].iid.toString();
				sys.debug("Interaction ID is " + xmpp_resource);
			}
			for(var j = 0; j < init[i].okcs.length; j++){
				okcs.push(init[i].okcs[j]);
//				sys.debug(init[i].okcs[j]);
			}
		}
		if(arguments.length == 3){
			execute(builtIns);
		}
		var count = 0;
		var length = okcs.length;
		retrieveOKCs(okcs, count, length, clauses);
	}
*/
	
//	function sendtext(){
//		var fullJID = 
//		client.send(new xmpp.Element("message", {to : "bob@okbook.inf.ed.ac.uk", type : "chat"}).c("body").t("send"));
//		setTimeout('sendtext();', 3000);
//	}
	
	function sendMSG(message, recepientJID){
		var success;
		var j = new xmpp.JID(recepientJID);
		j.resource = xmpp_resource;
		var recepientFullID = j.toString();
		sys.debug("Sending message " + message + " from " + peerFullID + " to " + recepientFullID);
//		sys.debug("to: " + recepientFullID);
		client.send(new xmpp.Element("message", {from : peerFullID, to : recepientFullID, type : "chat"}).c("body").t(message));
//		sendtext();
		success = true;
		return success;
	}
	
	function getLatestOfflineMessage(senderFullID, callback){
	
	}
	
	function updateVariableValueInJSON(src_msg, dest_msg){
		dest_msg.value = src_msg.value;
		setValue(dest_msg.name, dest_msg.value);
		if(dest_msg.params.length != 0 && dest_msg.params.length != 0){
			for(var i = 0; i < src_msg.params.length; i++){
				updateVariableValueInJSON(src_msg.params[i], dest_msg.params[i]);
			}
		}
	}
	
	function onMessageArrival(msg) {
		sys.debug("A new message came : " + msg.body); 
//		sys.debug(emitter.listeners("gotMessageFromXMPPServer").length);
		var senderJID = msg.from.toString();
		//TODO the sender id and the resource need to be checked here.
		var msgBody = JSON.parse(msg.body);
//		sys.debug("body : " + JSON.stringify(msgBody));
//update variables here
		//when receive message
		if(currentConstraintsNode != undefined){
			emitter.emit("msgReceived", msgBody, execute(currentMessageNode), execute(currentRoleNode), currentConstraintsNode);
			emitter.removeAllListeners("msgReceived");
		}
		else{
			emitter.emit("msgReceived", msgBody, execute(currentMessageNode), execute(currentRoleNode));
			emitter.removeAllListeners("msgReceived");
		}
	}
	
	function executeNextThenOrOrBranch(solved){
//		sys.puts("here: " + emitter.listeners("nextThenDEF").length);
//		sys.puts("next then node: " + nextThenNode);
		if(solved){
//			sys.debug("next then def: " + emitter.listeners("nextThenDEF"));
			if(emitter.listeners("nextThenDEF") != undefined && emitter.listeners("nextThenDEF").length != 0){
				sys.debug("nextThenDEF is not empty! --- " + emitter.listeners("nextThenDEF").length);
				emitter.emit("nextThenDEF", nextThenNode, "nextThenDEF");
			}
			else{
				if(niob_counter == 0){
					sys.debug("Interaction finished successfully!");
					test_end = (new Date()).getTime();
					sys.debug("total running time: " + (test_end - test_begin) + " ms");
					process.exit(0);
				}
				else{
					niob_counter--;
					if(niob_counter == 0){
						sys.debug("Interaction finished successfully!");
						test_end = (new Date()).getTime();
						sys.debug("total running time: " + (test_end - test_begin) + " ms");
						process.exit(0);	
					}
				}
			}
		}
		else{
			if(emitter.listeners("nextOrDEF") != undefined && emitter.listeners("nextOrDEF").length != 0){
					v_names = backtrack.v_names;
					v_values = backtrack.v_values;
//					sys.debug("track back after OR");
					emitter.emit("nextOrDEF", nextOrNode, "nextOrDEF");
			}
			else{
				throw constraitsSolvingFailedException();
			}
		}
	}
	
	function receiveMSG(msgBody, msgJSONStr, roleNode, currentConstraintsNode){
		msgJSON = eval("(" + msgJSONStr + ")");
		updateVariableValueInJSON(msgBody, msgJSON);
//		sys.debug("after update: " + JSON.stringify(msgBody) + "============" + JSON.stringify(msgJSON));
		if(arguments[3]){
			var solved = execute(currentConstraintsNode);
			currentConstraintsNode = undefined;
			executeNextThenOrOrBranch(solved);
		}
		else{
			executeNextThenOrOrBranch(true);
		}
	}
	
	
	
	function execute(node, removeListeners){
//		sys.debug("read string: " + read_string_exec);
		if(read_string_exec){
			process.nextTick(function(){try{execute(node, removeListeners);}catch(e){};},1000);
			throw "Wait";
		}	
		if(arguments.length == 2){
			if(removeListeners == "nextThenDEF"){
				emitter.removeAllListeners("nextThenDEF");
//				sys.debug("after remove we got : " + emitter.listeners("nextThenDEF"));	
			}
			else if(removeListeners == "nextOrDEF"){
				emitter.removeAllListeners("nextOrDEF");
//				sys.debug("after remove we got : " + emitter.listeners("nextOrDEF"));	
			}
		}
//		sys.debug("executing " + JSON.stringify(node));
		var ret = 0;
		if(!node)
			return 0;
		switch(node.type){
			case NODE_OP: 
				switch(node.value){
					case OP_ENTRY:
						if(node.children[0]){
//							sys.debug(JSON.stringify(clauses));
							execute(getRoleBodyByRoleHeadAfterRoleChanging(node.children[0]));
						}
						break;
					case OP_NONE:
						if(node.children[0]){
							execute(node.children[0]);
						}
						break;
					case OP_CLAUSE:
						if(node.children[0]){
//							clauses.push(node.children[0]);
							execute(node.children[0]);
						}
						if(node.children[1]){
							execute(node.children[1]);
						}
						break;
					case OP_HEADBODY:
						if(node.children[0]){
							role_heads.push(node.children[0]);
//							execute(node.children[0]);

						}
						if(node.children[1]){
							role_bodies.push(node.children[1]);
//							execute(node.children[1]);
						}
						break;
					case OP_ROLE_CHANGE:
						if(node.children[1]){
							if(execute(node.children[1])){
								sys.debug("Role change now!");
								execute(getRoleBodyByRoleHeadAfterRoleChanging(node.children[0]));
							}
							else{
								throw constraitsSolvingFailedException();
							}
						}
						else if(node.children[0]){
							sys.debug("Role change now!");
							execute(getRoleBodyByRoleHeadAfterRoleChanging(node.children[0]));						
						}
						break;
					case OP_ROLE:
						var roleID = node.children[1].value.toString();
						if(getValue(roleID) != null && getValue(roleID) != undefined){
							ret = getValue(roleID);
							break;
						}
						else{
							sys.debug("role parse: " + JSON.stringify(execute(node.children[0])));
							var temp = eval("[(" + execute(node.children[0]) + ")]");

/* read values from user input asynchronisely.
							readValueAsync(temp, function(){
								var roleType = temp[0];
								var roleName = roleType.name;
								for(var i = 0; i < init.length; i++){
	//								sys.debug(roleName.toString().toLowerCase() + " : " + init[i].role.toString().toLowerCase());
									if(roleName.toString().toLowerCase() == init[i].role.toString().toLowerCase()){
										setValue(roleID, init[i].jid.toString());
	//									sys.debug(roleID + " " + init[i].jid.toString());
										var jid = init[i].jid.toString();
										ret = jid; 
									}
								}
								sys.debug("after prompt");
							});
*/
							readValue(temp);
							var roleType = temp[0];
							var roleName = roleType.name;
							var roleFoundInInit = true;
							var roleJID = "";
							for(var i = 0; i < init.length; i++){
								sys.debug(roleName.toString().toLowerCase() + " : " + init[i].role.toString().toLowerCase());
								if(roleName.toString().toLowerCase() == init[i].role.toString().toLowerCase()){
									setValue(roleID, init[i].jid.toString());
									sys.debug(roleID + " " + init[i].jid.toString());
									roleJID = init[i].jid.toString();
									roleFoundInInit = true;
									break;
								}
								roleFoundInInit = false;
							}
							//possibly read in values inside temp here.
							if(roleFoundInInit){
								ret = roleJID; 
								break;
							}
							else{
//								sys.debug(roleID + " : " + getValue(roleID));
								throw CommunicationIDNotFoundException(roleName);
							}
//							sys.debug("after prompt");
   							
   						}
					case OP_KNOWS:
						if(node.children[0])
							okcs.push(removeQuotes(node.children[0].toString()));
						break;
					case OP_PLAYS:
						if(node.children[0] && node.children[1]){
							var info = {};
							info["jid"] = removeQuotes(node.children[0].toString());
							info["role"] = node.children[1].toString();
							init.push(info);	
						}
						break;
					case OP_IID:
						if(node.children[0])
							xmpp_resource = removeQuotes(node.children[0].toString());
						break;
					case OP_ROLE_TYPE:
						var ret = execute(node.children[0]);
						break;
					case OP_TERMS:
						if(node.children[1]){
							ret = execute(node.children[0]) + ", " + execute(node.children[1]);
						}
						else{
							ret = execute(node.children[0]);
						}
						break;
					case OP_FACTOR:
						if(node.children[1])
							ret = '{ "name" : "' + node.children[0] + '", "value" : "' + getValue(node.children[0]) + '", "params" : [' + execute(node.children[1]) + ']}';
						else{
							if(node.children[0].toString().charAt(0) == "[" && node.children[0].toString().charAt(node.children[0].toString().length - 1) == "]"){
								ret = '{ "name" : "list", "value" : [' + eval(node.children[0]).toString() + '], "params" : []}';
							}
							else if(node.children[0].toString().charAt(0) == "'" && node.children[0].toString().charAt(node.children[0].toString().length - 1) == "'"){
								ret = '{ "name" : "string", "value" : "' + removeQuotes(node.children[0].toString()) + '", "params" : []}';
							}
							else if(node.children[0].toString().charAt(0) == "\"" && node.children[0].toString().charAt(node.children[0].toString().length - 1) == "\""){
								ret = '{ "name" : "string", "value" : "' + removeQuotes(node.children[0].toString()) + '", "params" : []}';
							}
							else{
								ret = '{ "name" : "' + node.children[0] + '", "value" : "' + getValue(node.children[0]) + '", "params" : []}';
							}
						}
						break;
					case OP_CONSTRAINT://TODO need check the Variables and which of them are inputs and wich of them are outputs (callback?).
						var constraintName = node.children[0];
						if(node.children[1]){
//						sys.debug(execute(node.children[1]));
				//		sys.debug(eval("JSON.parse(\"" + execute(node.children[1]) + "\");"));

/*  read value from user input asynchronisely.
						eval(constraintName + "_okc_hook" + "(eval(\'([\' + \'" + execute(node.children[1]) + "\' + \'])\'), peerHelper, function(satisfied){" +
						"	ret = satisfied;" +
						"	if(ret == null || ret == undefined || ret == false)" +
						"		throw invalidOKCException(funcName);" +
						"})"); //according to "Conventions over configurations"
*/

							ret = eval(constraintName + "_okc_hook" + "(eval(\'([\' + \'" + execute(node.children[1]) + "\' + \'])\'), peerHelper, sys)"); //according to "Conventions over configurations"
						}
						else{
							ret = eval(constraintName + "_okc_hook" + "(eval(\'([\' + \'])\'), peerHelper);");
						}
						if(ret == null || ret == undefined || ret == false)
							throw invalidOKCException(funcName);
						break;
					case OP_NEGATE:
						ret = !execute(node.children[0]);	
						break;
					case OP_LOGAND:
						ret = execute(node.children[0]) && execute(node.children[1]);
						break;
					case OP_LOGOR:
						backtrack = {};
						backtrack.v_names = v_names;
						backtrack.v_values = v_values;
						if(execute(node.children[0])){
							ret = ture;
						}
						else{
//							sys.debug("trackback after ||");
							v_names = backtrack.v_names;
							v_values = backtrack.v_values;
							ret = execute(node.children[1]);
						}
						break;
					case OP_LIST:
	//					sys.debug("hit list");
						var list = execute(node.children[0], niob_context);
						var listHead = execute(node.children[1], niob_context);
						var listTail = execute(node.children[2], niob_context);
						if(listHead != undefined && listTail != undefined && listTail.length){
							setValue(node.children[0].value.toString(), listTail.unshift(listHead));
							ret = true;
						}
						else if(list != undefined && list.length){
							if(list.length == 0){
								setValue(node.children[1].value.toString(), new Array());
								setValue(node.children[2].value.toString(), new Array());
							}
							else{
								setValue(node.children[1].value.toString(), list[0]);
								list.shift();
								setValue(node.children[2].value.toString(), list);
							}
							ret = true;
						}	
						else{
							throw listDefinitionNotSupportedException();
						}					
						break;
					case OP_THEN:
						sys.debug("hit 'then'");
						emitter.removeAllListeners("nextThenDEF");
//						sys.debug("after remove we got : " + emitter.listeners("nextThenDEF"));
						nextThenNode = node.children[1];
//						thens.unshift(nextThenNode);
						emitter.on("nextThenDEF", execute);
//						sys.debug("the next then will be: " +JSON.stringify(nextThenNode) + "  : nextThenDefLength: " + emitter.listeners("nextThenDEF").length);
						execute(node.children[0]);
						break;
					case OP_OR:
//						sys.debug("hit 'or'");
						emitter.removeAllListeners("nextOrDEF");
//						sys.debug("after remove we got : " + emitter.listeners("nextThenDEF"));
						nextOrNode = node.children[1];
						emitter.on("nextOrDEF", execute);
						backtrack = {};
						backtrack.v_names = v_names;
						backtrack.v_values = v_values;
						execute(node.children[0]);
						break;
					case OP_NIOB:
						niob_counter++;
//						sys.debug("niob counter: " + niob_counter);
						sys.debug("hit 'niob'");
						execute(node.children[0]);
						execute(node.children[1]);
						break;
/*					case OP_PAR:
						
						break;
*/						
					case OP_SEND:
//						sys.debug("message : " + JSON.stringify(node.children[0]));
//						sys.debug("receipient : " + execute(node.children[1]));
						var msgNode = node.children[0];
						var roleNode = node.children[1];
						var solved = true;
						var message = execute(msgNode);
						var recepientJID = execute(roleNode);
						if(node.children[2]){
//							sys.debug(sys.inspect(node.children[2]));
							solved = execute(node.children[2]);
//							sys.debug("solved : " + solved);
							if(solved){
								sendMSG(message, recepientJID);
								sys.debug("Message sent!");
							}
							executeNextThenOrOrBranch(solved);
						}
						else{
							sendMSG(message, recepientJID);
							sys.debug("Message sent!");
//							sys.debug("next then DEF: " + emitter.listeners("nextThenDEF"));
							executeNextThenOrOrBranch(true);
						}
						break;
					case OP_RECEIVE: 
						emitter.removeAllListeners("receive");
						currentMessageNode = node.children[0];
						currentRoleNode = node.children[1];
						if(node.children[2]){
							currentConstraintsNode = node.children[2];
						}
						else{
							currentConstriantsNode = null;
						}
						emitter.on("msgReceived", receiveMSG);
						sys.debug("Start waiting for a new message");
						client.send(new xmpp.Element("presence", { from : peerFullID }).c("status").t("Available").up().c("priority").t("1"));	// retrieve offline message does not work this way
						break;
					case OP_MESSAGE:
						ret = '{ "name" : "' + node.children[0] + '", "value" : "' + getValue(node.children[0]) + '", "params" : [' + execute(node.children[1]) + ']}';
//						sys.debug("return message : " + ret);
						break;
					case OP_NO_MSG:
						sys.debug("hit 'no msg'");
						ret = execute(node.children[0]);
						sys.debug("ret:" + ret);
						executeNextThenOrOrBranch(ret);
						break;
					case OP_EQU:
						ret = execute(node.children[0], niob_context) == execute(node.children[1], niob_context);
						break;
					case OP_NEQ:
						ret = execute(node.children[0], niob_context) != execute(node.children[1], niob_context);
						break;
					case OP_GRT:
						ret = execute(node.children[0], niob_context) > execute(node.children[1], niob_context);
						break;
					case OP_LOT:
						ret = execute(node.children[0], niob_context) < execute(node.children[1], niob_context);
						break;
					case OP_GRE:
						ret = execute(node.children[0], niob_context) >= execute(node.children[1], niob_context);
						break;
					case OP_LOE:
						ret = execute(node.children[0], niob_context) <= execute(node.children[1], niob_context);
						break;					
					case OP_ASSIGN:
						setValue(node.children[0].value.toString(), execute(node.children[1], niob_context));
						ret = true;
						break;						
				}
				break;
			case NODE_VAR:
				if(getValue(node.value))
					ret = getValue(node.value);
				else
					ret = node.value;
				break;
			case NODE_CONST:
				ret = node.value;
				break;
			case NODE_ARR:
				ret = eval(node.value);
				break;
			case NODE_STR:
				ret = removeQuotes(node.value.toString());
				break;
		}
		return ret;
	}
	
	function invalidOKCException(okcName){
		 sys.debug("ERROR: OKC " + "'" + okcName + "()' has not been loaded."); 
		 process.exit(1);
	}
	
	function roleDefinitionNotFoundException(roleName){
		sys.debug("ERROR: Role " + "'" + roleName + "' has not been defined in this interaction model.");
		process.exit(1);
	}
	
	function constraitsSolvingFailedException(){
		sys.debug("ERROR: Constraints can not be solved. Interaction terminated without completion!");
		process.exit(1);
	}

	function listDefinitionNotSupportedException(){
		sys.debug("This usage of the constraint list is not supported or correct.");
		process.exit(1);
	}
	
	function CommunicationIDNotFoundException(roleName){
		sys.debug("Cannot find the communication ID (Jabber ID) of the message receiver with the role name: " + roleName);
		process.exit(1);
	}

	

/*
	Default template driver for JS/CC generated parsers running as
	browser-based JavaScript/ECMAScript applications.
	
	WARNING: 	This parser template will not run as console and has lesser
				features for debugging than the console derivates for the
				various JavaScript platforms.
	
	Features:
	- Parser trace messages
	- Integrated panic-mode error recovery
	
	Written 2007, 2008 by Jan Max Meyer, J.M.K S.F. Software Technologies
	
	This is in the public domain.
*/

var NODEJS__dbg_withtrace		= false;
var NODEJS__dbg_string			= new String();
if(NODEJS__dbg_withtrace){
	var fd = require("fs").openSync("NODEJS__dbg_withtrace.log", "w+");
	require('fs').writeSync(fd, new Date );
}
function __NODEJS_dbg_print( text )
{
	NODEJS__dbg_string += text + "\n";
}

function __NODEJS_lex( info )
{
	var state		= 0;
	var match		= -1;
	var match_pos	= 0;
	var start		= 0;
	var pos			= info.offset + 1;

	do
	{
		pos--;
		state = 0;
		match = -2;
		start = pos;

		if( info.src.length <= start )
			return 57;

		do
		{

switch( state )
{
	case 0:
		if( ( info.src.charCodeAt( pos ) >= 9 && info.src.charCodeAt( pos ) <= 10 ) || info.src.charCodeAt( pos ) == 13 || info.src.charCodeAt( pos ) == 32 ) state = 1;
		else if( info.src.charCodeAt( pos ) == 40 ) state = 2;
		else if( info.src.charCodeAt( pos ) == 41 ) state = 3;
		else if( info.src.charCodeAt( pos ) == 44 ) state = 4;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 5;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 6;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 7;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 8;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 9;
		else if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) ) state = 10;
		else if( info.src.charCodeAt( pos ) == 91 ) state = 11;
		else if( info.src.charCodeAt( pos ) == 93 ) state = 12;
		else if( info.src.charCodeAt( pos ) == 95 ) state = 13;
		else if( info.src.charCodeAt( pos ) == 97 ) state = 14;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 15;
		else if( info.src.charCodeAt( pos ) == 124 ) state = 16;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 17;
		else if( info.src.charCodeAt( pos ) == 33 ) state = 42;
		else if( ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 103 ) || info.src.charCodeAt( pos ) == 106 || info.src.charCodeAt( pos ) == 109 || ( info.src.charCodeAt( pos ) >= 113 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 34 ) state = 46;
		else if( info.src.charCodeAt( pos ) == 111 ) state = 47;
		else if( info.src.charCodeAt( pos ) == 38 ) state = 48;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 45 ) state = 52;
		else if( info.src.charCodeAt( pos ) == 47 ) state = 54;
		else if( info.src.charCodeAt( pos ) == 58 ) state = 56;
		else if( info.src.charCodeAt( pos ) == 105 ) state = 67;
		else if( info.src.charCodeAt( pos ) == 110 ) state = 69;
		else if( info.src.charCodeAt( pos ) == 104 ) state = 77;
		else if( info.src.charCodeAt( pos ) == 108 ) state = 79;
		else if( info.src.charCodeAt( pos ) == 116 ) state = 80;
		else if( info.src.charCodeAt( pos ) == 107 ) state = 83;
		else if( info.src.charCodeAt( pos ) == 112 ) state = 84;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 6:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 6;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 7:
		if( info.src.charCodeAt( pos ) == 45 ) state = 23;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 24;
		else state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 8:
		if( info.src.charCodeAt( pos ) == 60 ) state = 25;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 26;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 27;
		else state = -1;
		match = 32;
		match_pos = pos;
		break;

	case 9:
		if( info.src.charCodeAt( pos ) == 61 ) state = 28;
		else state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 10:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 10;
		else state = -1;
		match = 35;
		match_pos = pos;
		break;

	case 11:
		if( info.src.charCodeAt( pos ) == 93 ) state = 29;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 32 ) || ( info.src.charCodeAt( pos ) >= 34 && info.src.charCodeAt( pos ) <= 59 ) || ( info.src.charCodeAt( pos ) >= 63 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 122 ) || ( info.src.charCodeAt( pos ) >= 126 && info.src.charCodeAt( pos ) <= 254 ) ) state = 60;
		else if( info.src.charCodeAt( pos ) == 33 || ( info.src.charCodeAt( pos ) >= 60 && info.src.charCodeAt( pos ) <= 62 ) || info.src.charCodeAt( pos ) == 125 ) state = 62;
		else if( info.src.charCodeAt( pos ) == 124 ) state = 64;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 78;
		else state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 12:
		state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 13:
		state = -1;
		match = 33;
		match_pos = pos;
		break;

	case 14:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 15:
		state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 16:
		if( info.src.charCodeAt( pos ) == 124 ) state = 31;
		else state = -1;
		match = 34;
		match_pos = pos;
		break;

	case 17:
		state = -1;
		match = 21;
		match_pos = pos;
		break;

	case 18:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 19:
		if( info.src.charCodeAt( pos ) == 34 ) state = 46;
		else state = -1;
		match = 39;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 41;
		match_pos = pos;
		break;

	case 21:
		state = -1;
		match = 30;
		match_pos = pos;
		break;

	case 22:
		state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 23:
		state = -1;
		match = 31;
		match_pos = pos;
		break;

	case 24:
		state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 25:
		state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 26:
		state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 27:
		state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 28:
		state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 29:
		if( info.src.charCodeAt( pos ) == 93 ) state = 29;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 32 ) || ( info.src.charCodeAt( pos ) >= 34 && info.src.charCodeAt( pos ) <= 59 ) || ( info.src.charCodeAt( pos ) >= 63 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 122 ) || ( info.src.charCodeAt( pos ) >= 126 && info.src.charCodeAt( pos ) <= 254 ) ) state = 60;
		else if( info.src.charCodeAt( pos ) == 33 || ( info.src.charCodeAt( pos ) >= 60 && info.src.charCodeAt( pos ) <= 62 ) || info.src.charCodeAt( pos ) == 125 ) state = 62;
		else if( info.src.charCodeAt( pos ) == 124 ) state = 64;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 78;
		else state = -1;
		match = 38;
		match_pos = pos;
		break;

	case 30:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 31:
		state = -1;
		match = 40;
		match_pos = pos;
		break;

	case 32:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 33:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 34:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 35:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 36:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 37:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 38:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 39:
		if( info.src.charCodeAt( pos ) == 93 ) state = 39;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 123 ) || ( info.src.charCodeAt( pos ) >= 125 && info.src.charCodeAt( pos ) <= 254 ) ) state = 66;
		else state = -1;
		match = 37;
		match_pos = pos;
		break;

	case 40:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 41:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 42:
		if( info.src.charCodeAt( pos ) == 61 ) state = 18;
		else state = -1;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 44:
		if( info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 39;
		match_pos = pos;
		break;

	case 45:
		if( info.src.charCodeAt( pos ) == 93 ) state = 45;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 32 ) || ( info.src.charCodeAt( pos ) >= 34 && info.src.charCodeAt( pos ) <= 59 ) || ( info.src.charCodeAt( pos ) >= 63 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 122 ) || info.src.charCodeAt( pos ) == 124 || ( info.src.charCodeAt( pos ) >= 126 && info.src.charCodeAt( pos ) <= 254 ) ) state = 64;
		else state = -1;
		match = 38;
		match_pos = pos;
		break;

	case 46:
		if( info.src.charCodeAt( pos ) == 34 ) state = 19;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 33 ) || ( info.src.charCodeAt( pos ) >= 35 && info.src.charCodeAt( pos ) <= 254 ) ) state = 46;
		else state = -1;
		break;

	case 47:
		if( info.src.charCodeAt( pos ) == 114 ) state = 30;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 48:
		if( info.src.charCodeAt( pos ) == 38 ) state = 20;
		else state = -1;
		break;

	case 49:
		if( info.src.charCodeAt( pos ) == 100 ) state = 32;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 50:
		if( info.src.charCodeAt( pos ) == 39 ) state = 44;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 50;
		else state = -1;
		break;

	case 51:
		if( info.src.charCodeAt( pos ) == 116 ) state = 33;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 52:
		if( info.src.charCodeAt( pos ) == 62 ) state = 21;
		else state = -1;
		break;

	case 53:
		if( info.src.charCodeAt( pos ) == 100 ) state = 34;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 54:
		if( info.src.charCodeAt( pos ) == 47 ) state = 58;
		else state = -1;
		break;

	case 55:
		if( info.src.charCodeAt( pos ) == 116 ) state = 35;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 56:
		if( info.src.charCodeAt( pos ) == 58 ) state = 22;
		else state = -1;
		break;

	case 57:
		if( info.src.charCodeAt( pos ) == 98 ) state = 36;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || info.src.charCodeAt( pos ) == 97 || ( info.src.charCodeAt( pos ) >= 99 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 58:
		if( info.src.charCodeAt( pos ) == 10 ) state = 1;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 9 ) || ( info.src.charCodeAt( pos ) >= 11 && info.src.charCodeAt( pos ) <= 254 ) ) state = 58;
		else state = -1;
		break;

	case 59:
		if( info.src.charCodeAt( pos ) == 108 ) state = 37;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 60:
		if( info.src.charCodeAt( pos ) == 93 ) state = 29;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 32 ) || ( info.src.charCodeAt( pos ) >= 34 && info.src.charCodeAt( pos ) <= 59 ) || ( info.src.charCodeAt( pos ) >= 63 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 122 ) || ( info.src.charCodeAt( pos ) >= 126 && info.src.charCodeAt( pos ) <= 254 ) ) state = 60;
		else if( info.src.charCodeAt( pos ) == 33 || ( info.src.charCodeAt( pos ) >= 60 && info.src.charCodeAt( pos ) <= 62 ) || info.src.charCodeAt( pos ) == 125 ) state = 62;
		else if( info.src.charCodeAt( pos ) == 124 ) state = 64;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 78;
		else state = -1;
		break;

	case 61:
		if( info.src.charCodeAt( pos ) == 110 ) state = 38;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 62:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 122 ) || ( info.src.charCodeAt( pos ) >= 125 && info.src.charCodeAt( pos ) <= 254 ) ) state = 62;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 78;
		else state = -1;
		break;

	case 63:
		if( info.src.charCodeAt( pos ) == 115 ) state = 40;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 64:
		if( info.src.charCodeAt( pos ) == 93 ) state = 45;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 32 ) || ( info.src.charCodeAt( pos ) >= 34 && info.src.charCodeAt( pos ) <= 59 ) || ( info.src.charCodeAt( pos ) >= 63 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 122 ) || info.src.charCodeAt( pos ) == 124 || ( info.src.charCodeAt( pos ) >= 126 && info.src.charCodeAt( pos ) <= 254 ) ) state = 64;
		else state = -1;
		break;

	case 65:
		if( info.src.charCodeAt( pos ) == 115 ) state = 41;
		else if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 66:
		if( info.src.charCodeAt( pos ) == 93 ) state = 39;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 123 ) || ( info.src.charCodeAt( pos ) >= 125 && info.src.charCodeAt( pos ) <= 254 ) ) state = 66;
		else state = -1;
		break;

	case 67:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 105 ) state = 49;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 68:
		if( info.src.charCodeAt( pos ) == 125 ) state = 66;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 123 ) || ( info.src.charCodeAt( pos ) >= 126 && info.src.charCodeAt( pos ) <= 254 ) ) state = 68;
		else state = -1;
		break;

	case 69:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 111 ) state = 51;
		else if( info.src.charCodeAt( pos ) == 105 ) state = 72;
		else if( info.src.charCodeAt( pos ) == 117 ) state = 73;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 70:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 97 ) state = 53;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 71:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 115 ) state = 55;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 72:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 111 ) state = 57;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 73:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 108 ) state = 59;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 74:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 101 ) state = 61;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 75:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 119 ) state = 63;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 76:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 120 ) || info.src.charCodeAt( pos ) == 122 ) state = 43;
		else if( info.src.charCodeAt( pos ) == 121 ) state = 65;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 77:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 101 ) state = 70;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 78:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 123 ) || ( info.src.charCodeAt( pos ) >= 125 && info.src.charCodeAt( pos ) <= 254 ) ) state = 68;
		else state = -1;
		break;

	case 79:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 105 ) state = 71;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 80:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 104 ) state = 74;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 81:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 111 ) state = 75;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 82:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 97 ) state = 76;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 83:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 110 ) state = 81;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 84:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 43;
		else if( info.src.charCodeAt( pos ) == 108 ) state = 82;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

}


			pos++;

		}
		while( state > -1 );

	}
	while( 1 > -1 && match == 1 );

	if( match > -1 )
	{
		info.att = info.src.substr( start, match_pos - start );
		info.offset = match_pos;
		

	}
	else
	{
		info.att = new String();
		match = -1;
	}

	return match;
}


function __NODEJS_parse( src, err_off, err_la )
{
	var		sstack			= new Array();
	var		vstack			= new Array();
	var 	err_cnt			= 0;
	var		act;
	var		go;
	var		la;
	var		rval;
	var 	parseinfo		= new Function( "", "var offset; var src; var att;" );
	var		info			= new parseinfo();
	
/* Pop-Table */
var pop_tab = new Array(
	new Array( 0/* IM' */, 1 ),
	new Array( 45/* IM */, 2 ),
	new Array( 45/* IM */, 2 ),
	new Array( 45/* IM */, 6 ),
	new Array( 45/* IM */, 6 ),
	new Array( 45/* IM */, 7 ),
	new Array( 45/* IM */, 7 ),
	new Array( 42/* Clause_List */, 1 ),
	new Array( 42/* Clause_List */, 2 ),
	new Array( 46/* Clause */, 4 ),
	new Array( 46/* Clause */, 2 ),
	new Array( 43/* BuiltIn_List */, 1 ),
	new Array( 43/* BuiltIn_List */, 2 ),
	new Array( 49/* BuiltIn */, 7 ),
	new Array( 49/* BuiltIn */, 5 ),
	new Array( 49/* BuiltIn */, 5 ),
	new Array( 47/* Role */, 6 ),
	new Array( 50/* Type */, 1 ),
	new Array( 48/* Def */, 1 ),
	new Array( 48/* Def */, 3 ),
	new Array( 48/* Def */, 3 ),
	new Array( 48/* Def */, 3 ),
	new Array( 48/* Def */, 3 ),
	new Array( 53/* Interaction */, 3 ),
	new Array( 53/* Interaction */, 5 ),
	new Array( 53/* Interaction */, 3 ),
	new Array( 53/* Interaction */, 5 ),
	new Array( 53/* Interaction */, 3 ),
	new Array( 53/* Interaction */, 1 ),
	new Array( 53/* Interaction */, 3 ),
	new Array( 55/* Constraint */, 1 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 4 ),
	new Array( 55/* Constraint */, 4 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 3 ),
	new Array( 55/* Constraint */, 8 ),
	new Array( 56/* Terms */, 3 ),
	new Array( 56/* Terms */, 1 ),
	new Array( 52/* Term */, 1 ),
	new Array( 52/* Term */, 1 ),
	new Array( 52/* Term */, 1 ),
	new Array( 52/* Term */, 4 ),
	new Array( 52/* Term */, 1 ),
	new Array( 52/* Term */, 1 ),
	new Array( 51/* Id */, 1 ),
	new Array( 51/* Id */, 1 ),
	new Array( 51/* Id */, 1 ),
	new Array( 51/* Id */, 1 ),
	new Array( 54/* Message */, 4 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 2/* "head" */,4 , 8/* "plays" */,8 , 7/* "knows" */,9 , 9/* "iid" */,10 , 3/* "a" */,11 ),
	/* State 1 */ new Array( 57/* "$" */,0 ),
	/* State 2 */ new Array( 8/* "plays" */,8 , 7/* "knows" */,9 , 9/* "iid" */,10 ),
	/* State 3 */ new Array( 3/* "a" */,11 ),
	/* State 4 */ new Array( 16/* "(" */,15 ),
	/* State 5 */ new Array( 3/* "a" */,11 , 8/* "plays" */,-7 , 7/* "knows" */,-7 , 9/* "iid" */,-7 , 57/* "$" */,-7 ),
	/* State 6 */ new Array( 8/* "plays" */,8 , 7/* "knows" */,9 , 9/* "iid" */,10 , 3/* "a" */,-11 , 57/* "$" */,-11 ),
	/* State 7 */ new Array( 15/* "." */,18 , 13/* "::" */,19 ),
	/* State 8 */ new Array( 16/* "(" */,20 ),
	/* State 9 */ new Array( 16/* "(" */,21 ),
	/* State 10 */ new Array( 16/* "(" */,22 ),
	/* State 11 */ new Array( 16/* "(" */,23 ),
	/* State 12 */ new Array( 16/* "(" */,24 ),
	/* State 13 */ new Array( 57/* "$" */,-1 ),
	/* State 14 */ new Array( 57/* "$" */,-2 ),
	/* State 15 */ new Array( 37/* "JSONLIST" */,25 ),
	/* State 16 */ new Array( 8/* "plays" */,-8 , 7/* "knows" */,-8 , 9/* "iid" */,-8 , 57/* "$" */,-8 ),
	/* State 17 */ new Array( 3/* "a" */,-12 , 57/* "$" */,-12 ),
	/* State 18 */ new Array( 8/* "plays" */,-10 , 7/* "knows" */,-10 , 9/* "iid" */,-10 , 3/* "a" */,-10 , 57/* "$" */,-10 ),
	/* State 19 */ new Array( 20/* "{" */,28 , 11/* "null" */,31 , 36/* "Constant" */,33 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 3/* "a" */,11 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 20 */ new Array( 39/* "String" */,40 ),
	/* State 21 */ new Array( 39/* "String" */,41 ),
	/* State 22 */ new Array( 39/* "String" */,42 ),
	/* State 23 */ new Array( 36/* "Constant" */,45 , 35/* "Variable" */,46 , 38/* "LIST" */,47 , 39/* "String" */,48 , 33/* "_" */,49 ),
	/* State 24 */ new Array( 37/* "JSONLIST" */,50 ),
	/* State 25 */ new Array( 17/* ")" */,51 ),
	/* State 26 */ new Array( 6/* "niob" */,52 , 4/* "or" */,53 , 5/* "then" */,54 , 15/* "." */,55 ),
	/* State 27 */ new Array( 15/* "." */,-18 , 5/* "then" */,-18 , 4/* "or" */,-18 , 6/* "niob" */,-18 , 21/* "}" */,-18 ),
	/* State 28 */ new Array( 20/* "{" */,28 , 11/* "null" */,31 , 36/* "Constant" */,33 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 3/* "a" */,11 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 29 */ new Array( 29/* "<=" */,57 , 28/* "=>" */,58 ),
	/* State 30 */ new Array( 40/* "||" */,59 , 41/* "&&" */,60 , 31/* "<-" */,61 ),
	/* State 31 */ new Array( 31/* "<-" */,62 ),
	/* State 32 */ new Array( 31/* "<-" */,63 , 15/* "." */,-28 , 5/* "then" */,-28 , 4/* "or" */,-28 , 6/* "niob" */,-28 , 21/* "}" */,-28 ),
	/* State 33 */ new Array( 16/* "(" */,64 , 31/* "<-" */,-30 , 41/* "&&" */,-30 , 40/* "||" */,-30 , 22/* "==" */,-52 , 23/* "!=" */,-52 , 24/* ">" */,-52 , 25/* "<" */,-52 , 26/* ">=" */,-52 , 27/* "=<" */,-52 ),
	/* State 34 */ new Array( 16/* "(" */,65 ),
	/* State 35 */ new Array( 27/* "=<" */,66 , 26/* ">=" */,67 , 25/* "<" */,68 , 24/* ">" */,69 , 23/* "!=" */,70 , 22/* "==" */,71 ),
	/* State 36 */ new Array( 32/* "=" */,72 , 22/* "==" */,-53 , 23/* "!=" */,-53 , 24/* ">" */,-53 , 25/* "<" */,-53 , 26/* ">=" */,-53 , 27/* "=<" */,-53 ),
	/* State 37 */ new Array( 16/* "(" */,73 ),
	/* State 38 */ new Array( 22/* "==" */,-54 , 23/* "!=" */,-54 , 24/* ">" */,-54 , 25/* "<" */,-54 , 26/* ">=" */,-54 , 27/* "=<" */,-54 , 31/* "<-" */,-54 , 41/* "&&" */,-54 , 40/* "||" */,-54 , 15/* "." */,-54 , 5/* "then" */,-54 , 4/* "or" */,-54 , 6/* "niob" */,-54 , 21/* "}" */,-54 , 17/* ")" */,-54 , 14/* "," */,-54 ),
	/* State 39 */ new Array( 22/* "==" */,-55 , 23/* "!=" */,-55 , 24/* ">" */,-55 , 25/* "<" */,-55 , 26/* ">=" */,-55 , 27/* "=<" */,-55 , 31/* "<-" */,-55 , 41/* "&&" */,-55 , 40/* "||" */,-55 , 15/* "." */,-55 , 5/* "then" */,-55 , 4/* "or" */,-55 , 6/* "niob" */,-55 , 21/* "}" */,-55 , 17/* ")" */,-55 , 14/* "," */,-55 ),
	/* State 40 */ new Array( 14/* "," */,74 ),
	/* State 41 */ new Array( 17/* ")" */,75 ),
	/* State 42 */ new Array( 17/* ")" */,76 ),
	/* State 43 */ new Array( 14/* "," */,77 ),
	/* State 44 */ new Array( 14/* "," */,-17 ),
	/* State 45 */ new Array( 16/* "(" */,78 , 14/* "," */,-46 , 17/* ")" */,-46 ),
	/* State 46 */ new Array( 14/* "," */,-47 , 17/* ")" */,-47 ),
	/* State 47 */ new Array( 14/* "," */,-48 , 17/* ")" */,-48 ),
	/* State 48 */ new Array( 14/* "," */,-50 , 17/* ")" */,-50 ),
	/* State 49 */ new Array( 14/* "," */,-51 , 17/* ")" */,-51 ),
	/* State 50 */ new Array( 17/* ")" */,79 ),
	/* State 51 */ new Array( 15/* "." */,80 ),
	/* State 52 */ new Array( 20/* "{" */,28 , 11/* "null" */,31 , 36/* "Constant" */,33 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 3/* "a" */,11 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 53 */ new Array( 20/* "{" */,28 , 11/* "null" */,31 , 36/* "Constant" */,33 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 3/* "a" */,11 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 54 */ new Array( 20/* "{" */,28 , 11/* "null" */,31 , 36/* "Constant" */,33 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 3/* "a" */,11 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 55 */ new Array( 8/* "plays" */,-9 , 7/* "knows" */,-9 , 9/* "iid" */,-9 , 3/* "a" */,-9 , 57/* "$" */,-9 ),
	/* State 56 */ new Array( 6/* "niob" */,52 , 4/* "or" */,53 , 5/* "then" */,54 , 21/* "}" */,84 ),
	/* State 57 */ new Array( 3/* "a" */,11 ),
	/* State 58 */ new Array( 3/* "a" */,11 ),
	/* State 59 */ new Array( 36/* "Constant" */,88 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 60 */ new Array( 36/* "Constant" */,88 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 61 */ new Array( 36/* "Constant" */,91 ),
	/* State 62 */ new Array( 36/* "Constant" */,88 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 63 */ new Array( 36/* "Constant" */,88 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 64 */ new Array( 17/* ")" */,95 , 36/* "Constant" */,45 , 35/* "Variable" */,46 , 38/* "LIST" */,47 , 39/* "String" */,48 , 33/* "_" */,49 ),
	/* State 65 */ new Array( 36/* "Constant" */,88 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 66 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 67 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 68 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 69 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 70 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 71 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 72 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 73 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 74 */ new Array( 36/* "Constant" */,108 ),
	/* State 75 */ new Array( 15/* "." */,109 ),
	/* State 76 */ new Array( 15/* "." */,110 ),
	/* State 77 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 78 */ new Array( 36/* "Constant" */,45 , 35/* "Variable" */,46 , 38/* "LIST" */,47 , 39/* "String" */,48 , 33/* "_" */,49 ),
	/* State 79 */ new Array( 15/* "." */,113 ),
	/* State 80 */ new Array( 8/* "plays" */,8 , 7/* "knows" */,9 , 9/* "iid" */,10 , 3/* "a" */,11 ),
	/* State 81 */ new Array( 6/* "niob" */,-21 , 4/* "or" */,53 , 5/* "then" */,54 , 15/* "." */,-21 , 21/* "}" */,-21 ),
	/* State 82 */ new Array( 6/* "niob" */,-20 , 4/* "or" */,-20 , 5/* "then" */,54 , 15/* "." */,-20 , 21/* "}" */,-20 ),
	/* State 83 */ new Array( 6/* "niob" */,-19 , 4/* "or" */,-19 , 5/* "then" */,-19 , 15/* "." */,-19 , 21/* "}" */,-19 ),
	/* State 84 */ new Array( 15/* "." */,-22 , 5/* "then" */,-22 , 4/* "or" */,-22 , 6/* "niob" */,-22 , 21/* "}" */,-22 ),
	/* State 85 */ new Array( 15/* "." */,-25 , 5/* "then" */,-25 , 4/* "or" */,-25 , 6/* "niob" */,-25 , 21/* "}" */,-25 ),
	/* State 86 */ new Array( 31/* "<-" */,116 , 15/* "." */,-23 , 5/* "then" */,-23 , 4/* "or" */,-23 , 6/* "niob" */,-23 , 21/* "}" */,-23 ),
	/* State 87 */ new Array( 40/* "||" */,-42 , 41/* "&&" */,60 , 31/* "<-" */,-42 , 15/* "." */,-42 , 5/* "then" */,-42 , 4/* "or" */,-42 , 6/* "niob" */,-42 , 21/* "}" */,-42 , 17/* ")" */,-42 ),
	/* State 88 */ new Array( 16/* "(" */,117 , 31/* "<-" */,-30 , 41/* "&&" */,-30 , 40/* "||" */,-30 , 15/* "." */,-30 , 5/* "then" */,-30 , 4/* "or" */,-30 , 6/* "niob" */,-30 , 21/* "}" */,-30 , 17/* ")" */,-30 , 22/* "==" */,-52 , 23/* "!=" */,-52 , 24/* ">" */,-52 , 25/* "<" */,-52 , 26/* ">=" */,-52 , 27/* "=<" */,-52 ),
	/* State 89 */ new Array( 40/* "||" */,-41 , 41/* "&&" */,-41 , 31/* "<-" */,-41 , 15/* "." */,-41 , 5/* "then" */,-41 , 4/* "or" */,-41 , 6/* "niob" */,-41 , 21/* "}" */,-41 , 17/* ")" */,-41 ),
	/* State 90 */ new Array( 29/* "<=" */,118 ),
	/* State 91 */ new Array( 16/* "(" */,119 ),
	/* State 92 */ new Array( 40/* "||" */,59 , 41/* "&&" */,60 , 15/* "." */,-27 , 5/* "then" */,-27 , 4/* "or" */,-27 , 6/* "niob" */,-27 , 21/* "}" */,-27 ),
	/* State 93 */ new Array( 40/* "||" */,59 , 41/* "&&" */,60 , 15/* "." */,-29 , 5/* "then" */,-29 , 4/* "or" */,-29 , 6/* "niob" */,-29 , 21/* "}" */,-29 ),
	/* State 94 */ new Array( 14/* "," */,120 , 17/* ")" */,121 ),
	/* State 95 */ new Array( 31/* "<-" */,-31 , 41/* "&&" */,-31 , 40/* "||" */,-31 , 15/* "." */,-31 , 5/* "then" */,-31 , 4/* "or" */,-31 , 6/* "niob" */,-31 , 21/* "}" */,-31 , 17/* ")" */,-31 ),
	/* State 96 */ new Array( 17/* ")" */,-45 , 14/* "," */,-45 ),
	/* State 97 */ new Array( 40/* "||" */,59 , 41/* "&&" */,60 , 17/* ")" */,122 ),
	/* State 98 */ new Array( 31/* "<-" */,-39 , 41/* "&&" */,-39 , 40/* "||" */,-39 , 15/* "." */,-39 , 5/* "then" */,-39 , 4/* "or" */,-39 , 6/* "niob" */,-39 , 21/* "}" */,-39 , 17/* ")" */,-39 ),
	/* State 99 */ new Array( 31/* "<-" */,-52 , 41/* "&&" */,-52 , 40/* "||" */,-52 , 15/* "." */,-52 , 5/* "then" */,-52 , 4/* "or" */,-52 , 6/* "niob" */,-52 , 21/* "}" */,-52 , 17/* ")" */,-52 , 14/* "," */,-52 ),
	/* State 100 */ new Array( 31/* "<-" */,-53 , 41/* "&&" */,-53 , 40/* "||" */,-53 , 15/* "." */,-53 , 5/* "then" */,-53 , 4/* "or" */,-53 , 6/* "niob" */,-53 , 21/* "}" */,-53 , 17/* ")" */,-53 , 14/* "," */,-53 ),
	/* State 101 */ new Array( 31/* "<-" */,-38 , 41/* "&&" */,-38 , 40/* "||" */,-38 , 15/* "." */,-38 , 5/* "then" */,-38 , 4/* "or" */,-38 , 6/* "niob" */,-38 , 21/* "}" */,-38 , 17/* ")" */,-38 ),
	/* State 102 */ new Array( 31/* "<-" */,-37 , 41/* "&&" */,-37 , 40/* "||" */,-37 , 15/* "." */,-37 , 5/* "then" */,-37 , 4/* "or" */,-37 , 6/* "niob" */,-37 , 21/* "}" */,-37 , 17/* ")" */,-37 ),
	/* State 103 */ new Array( 31/* "<-" */,-36 , 41/* "&&" */,-36 , 40/* "||" */,-36 , 15/* "." */,-36 , 5/* "then" */,-36 , 4/* "or" */,-36 , 6/* "niob" */,-36 , 21/* "}" */,-36 , 17/* ")" */,-36 ),
	/* State 104 */ new Array( 31/* "<-" */,-35 , 41/* "&&" */,-35 , 40/* "||" */,-35 , 15/* "." */,-35 , 5/* "then" */,-35 , 4/* "or" */,-35 , 6/* "niob" */,-35 , 21/* "}" */,-35 , 17/* ")" */,-35 ),
	/* State 105 */ new Array( 31/* "<-" */,-34 , 41/* "&&" */,-34 , 40/* "||" */,-34 , 15/* "." */,-34 , 5/* "then" */,-34 , 4/* "or" */,-34 , 6/* "niob" */,-34 , 21/* "}" */,-34 , 17/* ")" */,-34 ),
	/* State 106 */ new Array( 31/* "<-" */,-40 , 41/* "&&" */,-40 , 40/* "||" */,-40 , 15/* "." */,-40 , 5/* "then" */,-40 , 4/* "or" */,-40 , 6/* "niob" */,-40 , 21/* "}" */,-40 , 17/* ")" */,-40 ),
	/* State 107 */ new Array( 14/* "," */,123 ),
	/* State 108 */ new Array( 17/* ")" */,124 ),
	/* State 109 */ new Array( 3/* "a" */,-14 , 8/* "plays" */,-14 , 7/* "knows" */,-14 , 9/* "iid" */,-14 , 57/* "$" */,-14 ),
	/* State 110 */ new Array( 3/* "a" */,-15 , 8/* "plays" */,-15 , 7/* "knows" */,-15 , 9/* "iid" */,-15 , 57/* "$" */,-15 ),
	/* State 111 */ new Array( 17/* ")" */,125 ),
	/* State 112 */ new Array( 14/* "," */,120 , 17/* ")" */,126 ),
	/* State 113 */ new Array( 57/* "$" */,-4 ),
	/* State 114 */ new Array( 3/* "a" */,11 ),
	/* State 115 */ new Array( 8/* "plays" */,8 , 7/* "knows" */,9 , 9/* "iid" */,10 , 57/* "$" */,-3 ),
	/* State 116 */ new Array( 36/* "Constant" */,88 , 12/* "not" */,34 , 35/* "Variable" */,36 , 10/* "list" */,37 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 117 */ new Array( 17/* ")" */,95 , 36/* "Constant" */,45 , 35/* "Variable" */,46 , 38/* "LIST" */,47 , 39/* "String" */,48 , 33/* "_" */,49 ),
	/* State 118 */ new Array( 3/* "a" */,11 ),
	/* State 119 */ new Array( 36/* "Constant" */,45 , 35/* "Variable" */,46 , 38/* "LIST" */,47 , 39/* "String" */,48 , 33/* "_" */,49 ),
	/* State 120 */ new Array( 36/* "Constant" */,45 , 35/* "Variable" */,46 , 38/* "LIST" */,47 , 39/* "String" */,48 , 33/* "_" */,49 ),
	/* State 121 */ new Array( 31/* "<-" */,-32 , 41/* "&&" */,-32 , 40/* "||" */,-32 , 28/* "=>" */,-56 , 29/* "<=" */,-56 ),
	/* State 122 */ new Array( 31/* "<-" */,-33 , 41/* "&&" */,-33 , 40/* "||" */,-33 , 15/* "." */,-33 , 5/* "then" */,-33 , 4/* "or" */,-33 , 6/* "niob" */,-33 , 21/* "}" */,-33 , 17/* ")" */,-33 ),
	/* State 123 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 124 */ new Array( 15/* "." */,135 ),
	/* State 125 */ new Array( 13/* "::" */,-16 , 15/* "." */,-16 , 31/* "<-" */,-16 , 5/* "then" */,-16 , 4/* "or" */,-16 , 6/* "niob" */,-16 , 21/* "}" */,-16 ),
	/* State 126 */ new Array( 14/* "," */,-49 , 17/* ")" */,-49 ),
	/* State 127 */ new Array( 57/* "$" */,-6 ),
	/* State 128 */ new Array( 57/* "$" */,-5 ),
	/* State 129 */ new Array( 40/* "||" */,59 , 41/* "&&" */,60 , 15/* "." */,-24 , 5/* "then" */,-24 , 4/* "or" */,-24 , 6/* "niob" */,-24 , 21/* "}" */,-24 ),
	/* State 130 */ new Array( 14/* "," */,120 , 17/* ")" */,136 ),
	/* State 131 */ new Array( 15/* "." */,-26 , 5/* "then" */,-26 , 4/* "or" */,-26 , 6/* "niob" */,-26 , 21/* "}" */,-26 ),
	/* State 132 */ new Array( 14/* "," */,120 , 17/* ")" */,137 ),
	/* State 133 */ new Array( 17/* ")" */,-44 , 14/* "," */,-44 ),
	/* State 134 */ new Array( 14/* "," */,138 ),
	/* State 135 */ new Array( 3/* "a" */,-13 , 8/* "plays" */,-13 , 7/* "knows" */,-13 , 9/* "iid" */,-13 , 57/* "$" */,-13 ),
	/* State 136 */ new Array( 31/* "<-" */,-32 , 41/* "&&" */,-32 , 40/* "||" */,-32 , 15/* "." */,-32 , 5/* "then" */,-32 , 4/* "or" */,-32 , 6/* "niob" */,-32 , 21/* "}" */,-32 , 17/* ")" */,-32 ),
	/* State 137 */ new Array( 29/* "<=" */,-56 ),
	/* State 138 */ new Array( 36/* "Constant" */,99 , 35/* "Variable" */,100 , 38/* "LIST" */,38 , 39/* "String" */,39 ),
	/* State 139 */ new Array( 17/* ")" */,140 ),
	/* State 140 */ new Array( 31/* "<-" */,-43 , 41/* "&&" */,-43 , 40/* "||" */,-43 , 15/* "." */,-43 , 5/* "then" */,-43 , 4/* "or" */,-43 , 6/* "niob" */,-43 , 21/* "}" */,-43 , 17/* ")" */,-43 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 45/* IM */,1 , 42/* Clause_List */,2 , 43/* BuiltIn_List */,3 , 46/* Clause */,5 , 49/* BuiltIn */,6 , 47/* Role */,7 ),
	/* State 1 */ new Array(  ),
	/* State 2 */ new Array( 44/* HEAD */,12 , 43/* BuiltIn_List */,13 , 49/* BuiltIn */,6 ),
	/* State 3 */ new Array( 42/* Clause_List */,14 , 46/* Clause */,5 , 47/* Role */,7 ),
	/* State 4 */ new Array(  ),
	/* State 5 */ new Array( 42/* Clause_List */,16 , 46/* Clause */,5 , 47/* Role */,7 ),
	/* State 6 */ new Array( 43/* BuiltIn_List */,17 , 49/* BuiltIn */,6 ),
	/* State 7 */ new Array(  ),
	/* State 8 */ new Array(  ),
	/* State 9 */ new Array(  ),
	/* State 10 */ new Array(  ),
	/* State 11 */ new Array(  ),
	/* State 12 */ new Array(  ),
	/* State 13 */ new Array(  ),
	/* State 14 */ new Array(  ),
	/* State 15 */ new Array(  ),
	/* State 16 */ new Array(  ),
	/* State 17 */ new Array(  ),
	/* State 18 */ new Array(  ),
	/* State 19 */ new Array( 48/* Def */,26 , 53/* Interaction */,27 , 54/* Message */,29 , 55/* Constraint */,30 , 47/* Role */,32 , 51/* Id */,35 ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array(  ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array( 50/* Type */,43 , 52/* Term */,44 ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array(  ),
	/* State 26 */ new Array(  ),
	/* State 27 */ new Array(  ),
	/* State 28 */ new Array( 48/* Def */,56 , 53/* Interaction */,27 , 54/* Message */,29 , 55/* Constraint */,30 , 47/* Role */,32 , 51/* Id */,35 ),
	/* State 29 */ new Array(  ),
	/* State 30 */ new Array(  ),
	/* State 31 */ new Array(  ),
	/* State 32 */ new Array(  ),
	/* State 33 */ new Array(  ),
	/* State 34 */ new Array(  ),
	/* State 35 */ new Array(  ),
	/* State 36 */ new Array(  ),
	/* State 37 */ new Array(  ),
	/* State 38 */ new Array(  ),
	/* State 39 */ new Array(  ),
	/* State 40 */ new Array(  ),
	/* State 41 */ new Array(  ),
	/* State 42 */ new Array(  ),
	/* State 43 */ new Array(  ),
	/* State 44 */ new Array(  ),
	/* State 45 */ new Array(  ),
	/* State 46 */ new Array(  ),
	/* State 47 */ new Array(  ),
	/* State 48 */ new Array(  ),
	/* State 49 */ new Array(  ),
	/* State 50 */ new Array(  ),
	/* State 51 */ new Array(  ),
	/* State 52 */ new Array( 48/* Def */,81 , 53/* Interaction */,27 , 54/* Message */,29 , 55/* Constraint */,30 , 47/* Role */,32 , 51/* Id */,35 ),
	/* State 53 */ new Array( 48/* Def */,82 , 53/* Interaction */,27 , 54/* Message */,29 , 55/* Constraint */,30 , 47/* Role */,32 , 51/* Id */,35 ),
	/* State 54 */ new Array( 48/* Def */,83 , 53/* Interaction */,27 , 54/* Message */,29 , 55/* Constraint */,30 , 47/* Role */,32 , 51/* Id */,35 ),
	/* State 55 */ new Array(  ),
	/* State 56 */ new Array(  ),
	/* State 57 */ new Array( 47/* Role */,85 ),
	/* State 58 */ new Array( 47/* Role */,86 ),
	/* State 59 */ new Array( 55/* Constraint */,87 , 51/* Id */,35 ),
	/* State 60 */ new Array( 55/* Constraint */,89 , 51/* Id */,35 ),
	/* State 61 */ new Array( 54/* Message */,90 ),
	/* State 62 */ new Array( 55/* Constraint */,92 , 51/* Id */,35 ),
	/* State 63 */ new Array( 55/* Constraint */,93 , 51/* Id */,35 ),
	/* State 64 */ new Array( 56/* Terms */,94 , 52/* Term */,96 ),
	/* State 65 */ new Array( 55/* Constraint */,97 , 51/* Id */,35 ),
	/* State 66 */ new Array( 51/* Id */,98 ),
	/* State 67 */ new Array( 51/* Id */,101 ),
	/* State 68 */ new Array( 51/* Id */,102 ),
	/* State 69 */ new Array( 51/* Id */,103 ),
	/* State 70 */ new Array( 51/* Id */,104 ),
	/* State 71 */ new Array( 51/* Id */,105 ),
	/* State 72 */ new Array( 51/* Id */,106 ),
	/* State 73 */ new Array( 51/* Id */,107 ),
	/* State 74 */ new Array(  ),
	/* State 75 */ new Array(  ),
	/* State 76 */ new Array(  ),
	/* State 77 */ new Array( 51/* Id */,111 ),
	/* State 78 */ new Array( 56/* Terms */,112 , 52/* Term */,96 ),
	/* State 79 */ new Array(  ),
	/* State 80 */ new Array( 43/* BuiltIn_List */,114 , 42/* Clause_List */,115 , 46/* Clause */,5 , 49/* BuiltIn */,6 , 47/* Role */,7 ),
	/* State 81 */ new Array(  ),
	/* State 82 */ new Array(  ),
	/* State 83 */ new Array(  ),
	/* State 84 */ new Array(  ),
	/* State 85 */ new Array(  ),
	/* State 86 */ new Array(  ),
	/* State 87 */ new Array(  ),
	/* State 88 */ new Array(  ),
	/* State 89 */ new Array(  ),
	/* State 90 */ new Array(  ),
	/* State 91 */ new Array(  ),
	/* State 92 */ new Array(  ),
	/* State 93 */ new Array(  ),
	/* State 94 */ new Array(  ),
	/* State 95 */ new Array(  ),
	/* State 96 */ new Array(  ),
	/* State 97 */ new Array(  ),
	/* State 98 */ new Array(  ),
	/* State 99 */ new Array(  ),
	/* State 100 */ new Array(  ),
	/* State 101 */ new Array(  ),
	/* State 102 */ new Array(  ),
	/* State 103 */ new Array(  ),
	/* State 104 */ new Array(  ),
	/* State 105 */ new Array(  ),
	/* State 106 */ new Array(  ),
	/* State 107 */ new Array(  ),
	/* State 108 */ new Array(  ),
	/* State 109 */ new Array(  ),
	/* State 110 */ new Array(  ),
	/* State 111 */ new Array(  ),
	/* State 112 */ new Array(  ),
	/* State 113 */ new Array(  ),
	/* State 114 */ new Array( 42/* Clause_List */,127 , 46/* Clause */,5 , 47/* Role */,7 ),
	/* State 115 */ new Array( 43/* BuiltIn_List */,128 , 49/* BuiltIn */,6 ),
	/* State 116 */ new Array( 55/* Constraint */,129 , 51/* Id */,35 ),
	/* State 117 */ new Array( 56/* Terms */,130 , 52/* Term */,96 ),
	/* State 118 */ new Array( 47/* Role */,131 ),
	/* State 119 */ new Array( 56/* Terms */,132 , 52/* Term */,96 ),
	/* State 120 */ new Array( 52/* Term */,133 ),
	/* State 121 */ new Array(  ),
	/* State 122 */ new Array(  ),
	/* State 123 */ new Array( 51/* Id */,134 ),
	/* State 124 */ new Array(  ),
	/* State 125 */ new Array(  ),
	/* State 126 */ new Array(  ),
	/* State 127 */ new Array(  ),
	/* State 128 */ new Array(  ),
	/* State 129 */ new Array(  ),
	/* State 130 */ new Array(  ),
	/* State 131 */ new Array(  ),
	/* State 132 */ new Array(  ),
	/* State 133 */ new Array(  ),
	/* State 134 */ new Array(  ),
	/* State 135 */ new Array(  ),
	/* State 136 */ new Array(  ),
	/* State 137 */ new Array(  ),
	/* State 138 */ new Array( 51/* Id */,139 ),
	/* State 139 */ new Array(  ),
	/* State 140 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"IM'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"head" /* Terminal symbol */,
	"a" /* Terminal symbol */,
	"or" /* Terminal symbol */,
	"then" /* Terminal symbol */,
	"niob" /* Terminal symbol */,
	"knows" /* Terminal symbol */,
	"plays" /* Terminal symbol */,
	"iid" /* Terminal symbol */,
	"list" /* Terminal symbol */,
	"null" /* Terminal symbol */,
	"not" /* Terminal symbol */,
	"::" /* Terminal symbol */,
	"," /* Terminal symbol */,
	"." /* Terminal symbol */,
	"(" /* Terminal symbol */,
	")" /* Terminal symbol */,
	"[" /* Terminal symbol */,
	"]" /* Terminal symbol */,
	"{" /* Terminal symbol */,
	"}" /* Terminal symbol */,
	"==" /* Terminal symbol */,
	"!=" /* Terminal symbol */,
	">" /* Terminal symbol */,
	"<" /* Terminal symbol */,
	">=" /* Terminal symbol */,
	"=<" /* Terminal symbol */,
	"=>" /* Terminal symbol */,
	"<=" /* Terminal symbol */,
	"->" /* Terminal symbol */,
	"<-" /* Terminal symbol */,
	"=" /* Terminal symbol */,
	"_" /* Terminal symbol */,
	"|" /* Terminal symbol */,
	"Variable" /* Terminal symbol */,
	"Constant" /* Terminal symbol */,
	"JSONLIST" /* Terminal symbol */,
	"LIST" /* Terminal symbol */,
	"String" /* Terminal symbol */,
	"||" /* Terminal symbol */,
	"&&" /* Terminal symbol */,
	"Clause_List" /* Non-terminal symbol */,
	"BuiltIn_List" /* Non-terminal symbol */,
	"HEAD" /* Non-terminal symbol */,
	"IM" /* Non-terminal symbol */,
	"Clause" /* Non-terminal symbol */,
	"Role" /* Non-terminal symbol */,
	"Def" /* Non-terminal symbol */,
	"BuiltIn" /* Non-terminal symbol */,
	"Type" /* Non-terminal symbol */,
	"Id" /* Non-terminal symbol */,
	"Term" /* Non-terminal symbol */,
	"Interaction" /* Non-terminal symbol */,
	"Message" /* Non-terminal symbol */,
	"Constraint" /* Non-terminal symbol */,
	"Terms" /* Non-terminal symbol */,
	"$" /* Terminal symbol */
);


	
	info.offset = 0;
	info.src = src;
	info.att = new String();
	
	if( !err_off )
		err_off	= new Array();
	if( !err_la )
	err_la = new Array();
	
	sstack.push( 0 );
	vstack.push( 0 );
	
	la = __NODEJS_lex( info );
	while( true )
	{
		act = 142;
		for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
		{
			if( act_tab[sstack[sstack.length-1]][i] == la )
			{
				act = act_tab[sstack[sstack.length-1]][i+1];
				break;
			}
		}

		if( NODEJS__dbg_withtrace && sstack.length > 0 )
		{
			__NODEJS_dbg_print( "\nState " + sstack[sstack.length-1] + "\n" +
							"\tLookahead: " + labels[la] + " (\"" + info.att + "\")\n" +
							"\tAction: " + act + "\n" + 
							"\tSource: \"" + info.src.substr( info.offset, 30 ) + ( ( info.offset + 30 < info.src.length ) ?
									"..." : "" ) + "\"\n" +
							"\tStack: " + sstack.join() + "\n" +
							"\tValue stack: " + vstack.join() + "\n" );
		}
		
			
		//Panic-mode: Try recovery when parse-error occurs!
		if( act == 142 )
		{
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "Error detected: There is no reduce or shift on the symbol " + labels[la] );
			
			err_cnt++;
			err_off.push( info.offset - info.att.length );			
			err_la.push( new Array() );
			for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
				err_la[err_la.length-1].push( labels[act_tab[sstack[sstack.length-1]][i]] );
			
			//Remember the original stack!
			var rsstack = new Array();
			var rvstack = new Array();
			for( var i = 0; i < sstack.length; i++ )
			{
				rsstack[i] = sstack[i];
				rvstack[i] = vstack[i];
			}
			
			while( act == 142 && la != 57 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery\n" +
									"Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
									"Action: " + act + "\n\n" );
				if( la == -1 )
					info.offset++;
					
				while( act == 142 && sstack.length > 0 )
				{
					sstack.pop();
					vstack.pop();
					
					if( sstack.length == 0 )
						break;
						
					act = 142;
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == la )
						{
							act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
				}
				
				if( act != 142 )
					break;
				
				for( var i = 0; i < rsstack.length; i++ )
				{
					sstack.push( rsstack[i] );
					vstack.push( rvstack[i] );
				}
				
				la = __NODEJS_lex( info );
			}
			
			if( act == 142 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery failed, terminating parse process..." );
				break;
			}


			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tError recovery succeeded, continuing" );
		}
		
		/*
		if( act == 142 )
			break;
		*/
		
		
		//Shift
		if( act > 0 )
		{			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "Shifting symbol: " + labels[la] + " (" + info.att + ")" );
		
			sstack.push( act );
			vstack.push( info.att );
			
			la = __NODEJS_lex( info );
			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tNew lookahead symbol: " + labels[la] + " (" + info.att + ")" );
		}
		//Reduce
		else
		{		
			act *= -1;
			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "Reducing by producution: " + act );
			
			rval = void(0);
			
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tPerforming semantic action..." );
			
switch( act )
{
	case 0:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 1:
	{
		 initialize(vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 2:
	{
		 initialize(vstack[ vstack.length - 1 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 3:
	{
		 initializeByHeader(vstack[ vstack.length - 4 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 4:
	{
		 initializeByHeader(vstack[ vstack.length - 3 ], vstack[ vstack.length - 6 ]); 
	}
	break;
	case 5:
	{
		 initializeByHeader(vstack[ vstack.length - 5 ], vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 6:
	{
		 initializeByHeader(vstack[ vstack.length - 5 ], vstack[ vstack.length - 1 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 7:
	{
		 rval = createNode(NODE_OP, OP_CLAUSE, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 8:
	{
		 rval = createNode(NODE_OP, OP_CLAUSE, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 9:
	{
		 rval = createNode(NODE_OP, OP_HEADBODY, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 10:
	{
		 rval = createNode(NODE_OP, OP_ENTRY, vstack[ vstack.length - 2 ]); 
	}
	break;
	case 11:
	{
		 rval = createNode(NODE_OP, OP_CLAUSE, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 12:
	{
		 rval = createNode(NODE_OP, OP_CLAUSE, vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 13:
	{
		 rval = createNode(NODE_OP, OP_PLAYS, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ]); 
	}
	break;
	case 14:
	{
		 rval = createNode(NODE_OP, OP_KNOWS, vstack[ vstack.length - 3 ]); 
	}
	break;
	case 15:
	{
		 rval = createNode(NODE_OP, OP_IID, vstack[ vstack.length - 3 ]); 
	}
	break;
	case 16:
	{
		 rval = createNode(NODE_OP, OP_ROLE, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 17:
	{
		 rval = createNode(NODE_OP, OP_ROLE_TYPE, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 18:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 19:
	{
		 rval = createNode(NODE_OP, OP_THEN, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 20:
	{
		 rval = createNode(NODE_OP, OP_OR, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 21:
	{
		 rval = createNode(NODE_OP, OP_NIOB, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 22:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 23:
	{
		 rval = createNode(NODE_OP, OP_SEND, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 24:
	{
		 rval = createNode(NODE_OP, OP_SEND, vstack[ vstack.length - 5 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 25:
	{
		 rval = createNode(NODE_OP, OP_RECEIVE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 26:
	{
		 rval = createNode(NODE_OP, OP_RECEIVE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ], vstack[ vstack.length - 5 ]); 
	}
	break;
	case 27:
	{
		 rval = createNode(NODE_OP, OP_NO_MSG, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 28:
	{
		 rval = createNode(NODE_OP, OP_ROLE_CHANGE, vstack[ vstack.length - 1 ] );
	}
	break;
	case 29:
	{
		 rval = createNode(NODE_OP, OP_ROLE_CHANGE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]) 
	}
	break;
	case 30:
	{
		 rval = true; 
	}
	break;
	case 31:
	{
		 rval = createNode(NODE_OP, OP_CONSTRAINT, vstack[ vstack.length - 3 ]); 
	}
	break;
	case 32:
	{
		 rval = createNode(NODE_OP, OP_CONSTRAINT, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 33:
	{
		 rval = createNode(NODE_OP, OP_NEGATE, vstack[ vstack.length - 2 ]); 
	}
	break;
	case 34:
	{
		 rval = createNode(NODE_OP, OP_EQU, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 35:
	{
		 rval = createNode(NODE_OP, OP_NEQ, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 36:
	{
		 rval = createNode(NODE_OP, OP_GRT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 37:
	{
		 rval = createNode(NODE_OP, OP_LOT, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 38:
	{
		 rval = createNode(NODE_OP, OP_GRE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 39:
	{
		 rval = createNode(NODE_OP, OP_LOE, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 40:
	{
		 rval = createNode(NODE_OP, OP_ASSIGN, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 41:
	{
		 rval = createNode(NODE_OP, OP_LOGAND, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 42:
	{
		 rval = createNode(NODE_OP, OP_LOGOR, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 43:
	{
		 rval = createNode(NODE_OP, OP_LIST, vstack[ vstack.length - 6 ], vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 44:
	{
		 rval = createNode(NODE_OP, OP_TERMS, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 45:
	{
		 rval = createNode(NODE_OP, OP_TERMS, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 46:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 47:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 48:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 49:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ])
	}
	break;
	case 50:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 51:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 52:
	{
		 rval = createNode(NODE_CONST, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 53:
	{
		 rval = createNode(NODE_VAR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 54:
	{
		 rval = createNode(NODE_ARR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 55:
	{
		 rval = createNode(NODE_STR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 56:
	{
		 rval = createNode(NODE_OP, OP_MESSAGE, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
}



			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tPopping " + pop_tab[act][1] + " off the stack..." );
				
			for( var i = 0; i < pop_tab[act][1]; i++ )
			{
				sstack.pop();
				vstack.pop();
			}
									
			go = -1;
			for( var i = 0; i < goto_tab[sstack[sstack.length-1]].length; i+=2 )
			{
				if( goto_tab[sstack[sstack.length-1]][i] == pop_tab[act][0] )
				{
					go = goto_tab[sstack[sstack.length-1]][i+1];
					break;
				}
			}
			
			if( act == 0 )
				break;
				
			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tPushing non-terminal " + labels[ pop_tab[act][0] ] );
				
			sstack.push( go );
			vstack.push( rval );			
		}
		
		if( NODEJS__dbg_withtrace )
		{	
				
			require('fs').writeSync(fd, NODEJS__dbg_string );
			NODEJS__dbg_string = new String();
		}
	}

	if( NODEJS__dbg_withtrace )
	{
		__NODEJS_dbg_print( "\nParse complete." );
		require('fs').writeSync(fd, NODEJS__dbg_string );
		NODEJS__dbg_string = new String();
	}
	
	return err_cnt;
}



	if(process.argv.length == 5) {
		var str = require("fs").readFileSync( process.argv[2] ).toString("utf-8");
		var error_cnt = 0;
		var error_off = new Array();
		var error_la = new Array();
	
		if((error_cnt = __NODEJS_parse(str, error_off, error_la)) > 0) {
		    var i;
			for( i = 0; i < error_cnt; i++ ) {
				console.log( "Parse error near >" + str.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"" );
			}
			process.exit(1);
		}
	}
	else {
		console.log("Usage: node xlcc.js <IM_NAME.xlc> <JID> <PASSWORD>");
		process.exit(1);
	}

