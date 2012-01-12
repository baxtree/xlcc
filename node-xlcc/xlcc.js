
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
		sys.debug("before return");
		return data;
	};
	process.stdin.pause();
	
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
				sys.debug(JSON.stringify(result));
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
						sys.debug("Please assign a new value to variable '" + factors[i].name + "(" + factors[i].value + ")':");
						var fvalue = read_string();
						factors[i].value = fvalue;
						setValue(factors[i].name, fvalue);
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
	
	function isIdenticalRole(tnode1, tnode2){ //TODO need testing
		if(typeof(tnode1) == "string" && typeof(tnode2) == "string"){
			return true;	
		}
		else if(typeof(tnode1) == "string" && typeof(tnode2) != "string" || typeof(tnode1) != "string" && typeof(tnode2) == "string"){
			return false;
		}
		else{
			if((tnode1.type == 1 && tnode1.type.toString() == tnode2.type.toString() && tnode1.value.toString() == tnode2.value.toString())
			|| (tnode1.type != 1 && tnode1.type.toString() == tnode2.type.toString())){
				if(tnode1.children.length == 0 && tnode2.children.length == 0){
					return true;
				}
				else if(tnode1.children.length == tnode2.children.length){
					for(var i = 0; i < tnode1.children.length; i++){
						if(isIdenticalRole(tnode1.children[i], tnode2.children[i])){
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
			if(isIdenticalRole(role_head, role_heads[i])){
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
		var role_body = null;
//		sys.debug("number of pairs of heads and bodies: " + role_heads.length);
		for(var i = 0; i < role_heads.length; i++){
//			sys.debug(JSON.stringify(role_head) + "================" + JSON.stringify(role_heads[i]));
			if(isIdenticalRole(role_head, role_heads[i])){
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
							if(execute(node.children[1]) && node.children[1]){
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
						var roleIdNode = execute(node.children[1]);
//						sys.debug("role parse: " + JSON.stringify(execute(node.children[0])));
						var temp = eval("[(" + execute(node.children[0]) + ")]");

/* read values from user input asynchronisely.
						readValueAsync(temp, function(){
							var roleType = temp[0];
							var roleName = roleType.name;
							for(var i = 0; i < init.length; i++){
	//							sys.debug(roleName.toString().toLowerCase() + " : " + init[i].role.toString().toLowerCase());
								if(roleName.toString().toLowerCase() == init[i].role.toString().toLowerCase()){
									setValue(roleIdNode, init[i].jid.toString());
	//								sys.debug(roleIdNode + " " + init[i].jid.toString());
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
						for(var i = 0; i < init.length; i++){
//							sys.debug(roleName.toString().toLowerCase() + " : " + init[i].role.toString().toLowerCase());
							if(roleName.toString().toLowerCase() == init[i].role.toString().toLowerCase()){
								setValue(roleIdNode, init[i].jid.toString());
//								sys.debug(roleIdNode + " " + init[i].jid.toString());
								var jid = init[i].jid.toString();
								ret = jid; 
							}
						}
						//possibly read in values inside temp here.
//						sys.debug("after prompt");
   						break;
					case OP_KNOWS:
						if(node.children[0])
							okcs.push(node.children[0].toString());
						break;
					case OP_PLAYS:
						if(node.children[0] && node.children[1]){
							var info = {};
							info["jid"] = node.children[0].toString();
							info["role"] = node.children[1].toString();
							init.push(info);	
						}
						break;
					case OP_IID:
						if(node.children[0])
							xmpp_resource = node.children[0].toString();
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
						else
							ret = '{ "name" : "' + node.children[0] + '", "value" : "' + getValue(node.children[0]) + '", "params" : []}';
						break;
					case OP_CONSTRAINT://TODO need check the Variables and which of them are inputs and wich of them are outputs (callback?).
						var constraintName = node.children[0];
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
						if(execute(node.children[0]) != undefined){
							if(execute(node.children[0]).length == 0){
								setValue(node.children[1].value.toString(), []);
								setValue(node.children[2].value.toString(), []);
							}
							else if(execute(node.children[0]).length = 1){
								setValue(node.children[1].value.toString(), execute(node.children[0])[0]);
								setValue(node.children[2].value.toString(), []);
							}
							else if(execute(node.children[0]).length > 1){
								setValue(node.children[1].value.toString(), execute(node.children[0])[0]);
								setValue(node.children[2].value.toString(), execute(node.children[0]).slice(1));
							}
						}
						else if(execute(node.children[1]) != undefined && execute(node.children[2]) != undefined){
							setValue(node.children[0].value.toString(), execute(node.children[1]).concat(execute(node.children[2])));
						}
						if(execute(node.children[1]) != undefined && execute(node.children[2]) != undefined){
							setValue(node.children[0].value.toString(), []);
						}
						ret = true;
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
			return 47;

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
		else if( info.src.charCodeAt( pos ) == 61 ) state = 7;
		else if( info.src.charCodeAt( pos ) == 65 ) state = 8;
		else if( ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 71 ) || info.src.charCodeAt( pos ) == 74 || ( info.src.charCodeAt( pos ) >= 76 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 81 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 91 ) state = 10;
		else if( info.src.charCodeAt( pos ) == 93 ) state = 11;
		else if( info.src.charCodeAt( pos ) == 95 ) state = 12;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 13;
		else if( info.src.charCodeAt( pos ) == 124 ) state = 14;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 15;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 33;
		else if( ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 103 ) || info.src.charCodeAt( pos ) == 106 || ( info.src.charCodeAt( pos ) >= 108 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 113 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 97 ) state = 35;
		else if( info.src.charCodeAt( pos ) == 79 ) state = 36;
		else if( info.src.charCodeAt( pos ) == 38 ) state = 46;
		else if( info.src.charCodeAt( pos ) == 111 ) state = 47;
		else if( info.src.charCodeAt( pos ) == 45 ) state = 49;
		else if( info.src.charCodeAt( pos ) == 47 ) state = 52;
		else if( info.src.charCodeAt( pos ) == 58 ) state = 55;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 58;
		else if( info.src.charCodeAt( pos ) == 73 ) state = 71;
		else if( info.src.charCodeAt( pos ) == 105 ) state = 72;
		else if( info.src.charCodeAt( pos ) == 78 ) state = 73;
		else if( info.src.charCodeAt( pos ) == 110 ) state = 74;
		else if( info.src.charCodeAt( pos ) == 72 ) state = 87;
		else if( info.src.charCodeAt( pos ) == 104 ) state = 88;
		else if( info.src.charCodeAt( pos ) == 84 ) state = 89;
		else if( info.src.charCodeAt( pos ) == 116 ) state = 90;
		else if( info.src.charCodeAt( pos ) == 75 ) state = 95;
		else if( info.src.charCodeAt( pos ) == 107 ) state = 96;
		else if( info.src.charCodeAt( pos ) == 80 ) state = 97;
		else if( info.src.charCodeAt( pos ) == 112 ) state = 98;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 6:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 6;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 7:
		if( info.src.charCodeAt( pos ) == 62 ) state = 21;
		else state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 8:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 9:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 10:
		if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 254 ) ) state = 64;
		else state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 11:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 12:
		state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 13:
		state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 14:
		if( info.src.charCodeAt( pos ) == 124 ) state = 23;
		else state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 15:
		state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 16:
		state = -1;
		match = 32;
		match_pos = pos;
		break;

	case 17:
		state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 18:
		state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 19:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 21;
		match_pos = pos;
		break;

	case 21:
		state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 22:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 23:
		state = -1;
		match = 31;
		match_pos = pos;
		break;

	case 24:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 25:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 26:
		if( info.src.charCodeAt( pos ) == 93 ) state = 26;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 254 ) ) state = 64;
		else state = -1;
		match = 30;
		match_pos = pos;
		break;

	case 27:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 28:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 29:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 30:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 31:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 32:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 33:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 6;
		else if( ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else state = -1;
		break;

	case 34:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 35:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 36:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 22;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 37:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 38:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 39:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 40:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 41:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 42:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 44:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 45:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 46:
		if( info.src.charCodeAt( pos ) == 38 ) state = 16;
		else state = -1;
		break;

	case 47:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 37;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 48:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 24;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 49:
		if( info.src.charCodeAt( pos ) == 62 ) state = 17;
		else state = -1;
		break;

	case 50:
		state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 51:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 25;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 52:
		if( info.src.charCodeAt( pos ) == 47 ) state = 61;
		else state = -1;
		break;

	case 53:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 38;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 54:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 27;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 55:
		if( info.src.charCodeAt( pos ) == 58 ) state = 18;
		else state = -1;
		break;

	case 56:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 39;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 57:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || info.src.charCodeAt( pos ) == 65 || ( info.src.charCodeAt( pos ) >= 67 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || info.src.charCodeAt( pos ) == 97 || ( info.src.charCodeAt( pos ) >= 99 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 66 || info.src.charCodeAt( pos ) == 98 ) state = 28;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 58:
		if( info.src.charCodeAt( pos ) == 45 ) state = 19;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 20;
		else state = -1;
		break;

	case 59:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 69 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 101 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 40;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 60:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 29;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 61:
		if( info.src.charCodeAt( pos ) == 10 ) state = 1;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 9 ) || ( info.src.charCodeAt( pos ) >= 11 && info.src.charCodeAt( pos ) <= 254 ) ) state = 61;
		else state = -1;
		break;

	case 62:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 65 ) || ( info.src.charCodeAt( pos ) >= 67 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || info.src.charCodeAt( pos ) == 97 || ( info.src.charCodeAt( pos ) >= 99 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 66 || info.src.charCodeAt( pos ) == 98 ) state = 41;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 63:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 30;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 64:
		if( info.src.charCodeAt( pos ) == 93 ) state = 26;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 92 ) || ( info.src.charCodeAt( pos ) >= 94 && info.src.charCodeAt( pos ) <= 254 ) ) state = 64;
		else state = -1;
		break;

	case 65:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 42;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 66:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 31;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 67:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 43;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 68:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 32;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 69:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 44;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 70:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 45;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 71:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 48;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 72:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 53;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 73:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 51;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 77;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 79;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 74:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 56;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 78;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 80;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 75:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 54;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 76:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || info.src.charCodeAt( pos ) == 64 || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 59;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 77:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 57;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 78:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 62;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 79:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 60;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 80:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 65;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 81:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 63;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 82:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 67;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 83:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 66;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 84:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 86 ) || ( info.src.charCodeAt( pos ) >= 88 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 118 ) || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 69;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 85:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 88 ) || info.src.charCodeAt( pos ) == 90 || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 120 ) || info.src.charCodeAt( pos ) == 122 ) state = 9;
		else if( info.src.charCodeAt( pos ) == 89 || info.src.charCodeAt( pos ) == 121 ) state = 68;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 86:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 88 ) || info.src.charCodeAt( pos ) == 90 || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 120 ) || info.src.charCodeAt( pos ) == 122 ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 89 || info.src.charCodeAt( pos ) == 121 ) state = 70;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 87:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 75;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 88:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 76;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 89:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 81;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 90:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 82;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 91:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 83;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 92:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 84;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 93:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 85;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 94:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || info.src.charCodeAt( pos ) == 64 || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 86;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 95:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 91;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 96:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 92;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 97:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 9;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 93;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 98:
		if( ( info.src.charCodeAt( pos ) >= 46 && info.src.charCodeAt( pos ) <= 58 ) || ( info.src.charCodeAt( pos ) >= 64 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 34;
		else if( info.src.charCodeAt( pos ) == 34 || info.src.charCodeAt( pos ) == 39 ) state = 50;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 94;
		else state = -1;
		match = 29;
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
	new Array( 35/* IM */, 2 ),
	new Array( 35/* IM */, 2 ),
	new Array( 35/* IM */, 6 ),
	new Array( 35/* IM */, 6 ),
	new Array( 35/* IM */, 7 ),
	new Array( 35/* IM */, 7 ),
	new Array( 33/* Clause_List */, 1 ),
	new Array( 33/* Clause_List */, 2 ),
	new Array( 36/* Clause */, 4 ),
	new Array( 36/* Clause */, 2 ),
	new Array( 34/* BuiltIn_List */, 1 ),
	new Array( 34/* BuiltIn_List */, 2 ),
	new Array( 39/* BuiltIn */, 7 ),
	new Array( 39/* BuiltIn */, 5 ),
	new Array( 39/* BuiltIn */, 5 ),
	new Array( 37/* Role */, 6 ),
	new Array( 40/* Type */, 1 ),
	new Array( 38/* Def */, 1 ),
	new Array( 38/* Def */, 3 ),
	new Array( 38/* Def */, 3 ),
	new Array( 38/* Def */, 3 ),
	new Array( 38/* Def */, 3 ),
	new Array( 43/* Interaction */, 3 ),
	new Array( 43/* Interaction */, 5 ),
	new Array( 43/* Interaction */, 3 ),
	new Array( 43/* Interaction */, 5 ),
	new Array( 43/* Interaction */, 3 ),
	new Array( 43/* Interaction */, 1 ),
	new Array( 43/* Interaction */, 3 ),
	new Array( 45/* Constraint */, 1 ),
	new Array( 45/* Constraint */, 4 ),
	new Array( 45/* Constraint */, 4 ),
	new Array( 45/* Constraint */, 3 ),
	new Array( 45/* Constraint */, 3 ),
	new Array( 45/* Constraint */, 7 ),
	new Array( 46/* Terms */, 3 ),
	new Array( 46/* Terms */, 1 ),
	new Array( 42/* Term */, 1 ),
	new Array( 42/* Term */, 1 ),
	new Array( 42/* Term */, 4 ),
	new Array( 42/* Term */, 1 ),
	new Array( 41/* Id */, 1 ),
	new Array( 41/* Id */, 1 ),
	new Array( 44/* Message */, 4 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 2/* "HEAD" */,4 , 8/* "PLAYS" */,8 , 7/* "KNOWS" */,9 , 9/* "IID" */,10 , 3/* "A" */,11 ),
	/* State 1 */ new Array( 47/* "$" */,0 ),
	/* State 2 */ new Array( 2/* "HEAD" */,12 , 8/* "PLAYS" */,8 , 7/* "KNOWS" */,9 , 9/* "IID" */,10 ),
	/* State 3 */ new Array( 3/* "A" */,11 ),
	/* State 4 */ new Array( 14/* "(" */,15 ),
	/* State 5 */ new Array( 3/* "A" */,11 , 8/* "PLAYS" */,-7 , 7/* "KNOWS" */,-7 , 9/* "IID" */,-7 , 2/* "HEAD" */,-7 , 47/* "$" */,-7 ),
	/* State 6 */ new Array( 8/* "PLAYS" */,8 , 7/* "KNOWS" */,9 , 9/* "IID" */,10 , 3/* "A" */,-11 , 47/* "$" */,-11 ),
	/* State 7 */ new Array( 13/* "." */,18 , 11/* "::" */,19 ),
	/* State 8 */ new Array( 14/* "(" */,20 ),
	/* State 9 */ new Array( 14/* "(" */,21 ),
	/* State 10 */ new Array( 14/* "(" */,22 ),
	/* State 11 */ new Array( 14/* "(" */,23 ),
	/* State 12 */ new Array( 14/* "(" */,24 ),
	/* State 13 */ new Array( 47/* "$" */,-1 ),
	/* State 14 */ new Array( 47/* "$" */,-2 ),
	/* State 15 */ new Array( 30/* "JSON" */,25 ),
	/* State 16 */ new Array( 8/* "PLAYS" */,-8 , 7/* "KNOWS" */,-8 , 9/* "IID" */,-8 , 2/* "HEAD" */,-8 , 47/* "$" */,-8 ),
	/* State 17 */ new Array( 3/* "A" */,-12 , 47/* "$" */,-12 ),
	/* State 18 */ new Array( 8/* "PLAYS" */,-10 , 7/* "KNOWS" */,-10 , 9/* "IID" */,-10 , 2/* "HEAD" */,-10 , 3/* "A" */,-10 , 47/* "$" */,-10 ),
	/* State 19 */ new Array( 18/* "{" */,28 , 10/* "NULL" */,31 , 29/* "Constant" */,33 , 27/* "NOT" */,34 , 28/* "Variable" */,35 , 3/* "A" */,11 ),
	/* State 20 */ new Array( 29/* "Constant" */,36 ),
	/* State 21 */ new Array( 29/* "Constant" */,37 ),
	/* State 22 */ new Array( 29/* "Constant" */,38 ),
	/* State 23 */ new Array( 29/* "Constant" */,41 , 28/* "Variable" */,42 , 25/* "_" */,43 ),
	/* State 24 */ new Array( 30/* "JSON" */,44 ),
	/* State 25 */ new Array( 15/* ")" */,45 ),
	/* State 26 */ new Array( 6/* "NIOB" */,46 , 4/* "OR" */,47 , 5/* "THEN" */,48 , 13/* "." */,49 ),
	/* State 27 */ new Array( 13/* "." */,-18 , 5/* "THEN" */,-18 , 4/* "OR" */,-18 , 6/* "NIOB" */,-18 , 19/* "}" */,-18 ),
	/* State 28 */ new Array( 18/* "{" */,28 , 10/* "NULL" */,31 , 29/* "Constant" */,33 , 27/* "NOT" */,34 , 28/* "Variable" */,35 , 3/* "A" */,11 ),
	/* State 29 */ new Array( 21/* "<=" */,51 , 20/* "=>" */,52 ),
	/* State 30 */ new Array( 31/* "||" */,53 , 32/* "&&" */,54 , 23/* "<-" */,55 ),
	/* State 31 */ new Array( 23/* "<-" */,56 ),
	/* State 32 */ new Array( 23/* "<-" */,57 , 13/* "." */,-28 , 5/* "THEN" */,-28 , 4/* "OR" */,-28 , 6/* "NIOB" */,-28 , 19/* "}" */,-28 ),
	/* State 33 */ new Array( 14/* "(" */,58 , 23/* "<-" */,-30 , 32/* "&&" */,-30 , 31/* "||" */,-30 ),
	/* State 34 */ new Array( 14/* "(" */,59 ),
	/* State 35 */ new Array( 24/* "=" */,60 ),
	/* State 36 */ new Array( 12/* "," */,61 ),
	/* State 37 */ new Array( 15/* ")" */,62 ),
	/* State 38 */ new Array( 15/* ")" */,63 ),
	/* State 39 */ new Array( 12/* "," */,64 ),
	/* State 40 */ new Array( 12/* "," */,-17 ),
	/* State 41 */ new Array( 14/* "(" */,65 , 12/* "," */,-38 , 15/* ")" */,-38 ),
	/* State 42 */ new Array( 12/* "," */,-39 , 15/* ")" */,-39 ),
	/* State 43 */ new Array( 12/* "," */,-41 , 15/* ")" */,-41 ),
	/* State 44 */ new Array( 15/* ")" */,66 ),
	/* State 45 */ new Array( 13/* "." */,67 ),
	/* State 46 */ new Array( 18/* "{" */,28 , 10/* "NULL" */,31 , 29/* "Constant" */,33 , 27/* "NOT" */,34 , 28/* "Variable" */,35 , 3/* "A" */,11 ),
	/* State 47 */ new Array( 18/* "{" */,28 , 10/* "NULL" */,31 , 29/* "Constant" */,33 , 27/* "NOT" */,34 , 28/* "Variable" */,35 , 3/* "A" */,11 ),
	/* State 48 */ new Array( 18/* "{" */,28 , 10/* "NULL" */,31 , 29/* "Constant" */,33 , 27/* "NOT" */,34 , 28/* "Variable" */,35 , 3/* "A" */,11 ),
	/* State 49 */ new Array( 8/* "PLAYS" */,-9 , 7/* "KNOWS" */,-9 , 9/* "IID" */,-9 , 2/* "HEAD" */,-9 , 3/* "A" */,-9 , 47/* "$" */,-9 ),
	/* State 50 */ new Array( 6/* "NIOB" */,46 , 4/* "OR" */,47 , 5/* "THEN" */,48 , 19/* "}" */,71 ),
	/* State 51 */ new Array( 3/* "A" */,11 ),
	/* State 52 */ new Array( 3/* "A" */,11 ),
	/* State 53 */ new Array( 29/* "Constant" */,75 , 27/* "NOT" */,34 , 28/* "Variable" */,35 ),
	/* State 54 */ new Array( 29/* "Constant" */,75 , 27/* "NOT" */,34 , 28/* "Variable" */,35 ),
	/* State 55 */ new Array( 29/* "Constant" */,78 ),
	/* State 56 */ new Array( 29/* "Constant" */,75 , 27/* "NOT" */,34 , 28/* "Variable" */,35 ),
	/* State 57 */ new Array( 29/* "Constant" */,75 , 27/* "NOT" */,34 , 28/* "Variable" */,35 ),
	/* State 58 */ new Array( 29/* "Constant" */,41 , 28/* "Variable" */,42 , 25/* "_" */,43 ),
	/* State 59 */ new Array( 29/* "Constant" */,75 , 27/* "NOT" */,34 , 28/* "Variable" */,35 ),
	/* State 60 */ new Array( 16/* "[" */,84 ),
	/* State 61 */ new Array( 29/* "Constant" */,85 ),
	/* State 62 */ new Array( 13/* "." */,86 ),
	/* State 63 */ new Array( 13/* "." */,87 ),
	/* State 64 */ new Array( 29/* "Constant" */,89 , 28/* "Variable" */,90 ),
	/* State 65 */ new Array( 29/* "Constant" */,41 , 28/* "Variable" */,42 , 25/* "_" */,43 ),
	/* State 66 */ new Array( 13/* "." */,92 ),
	/* State 67 */ new Array( 8/* "PLAYS" */,8 , 7/* "KNOWS" */,9 , 9/* "IID" */,10 , 3/* "A" */,11 ),
	/* State 68 */ new Array( 6/* "NIOB" */,-21 , 4/* "OR" */,47 , 5/* "THEN" */,48 , 13/* "." */,-21 , 19/* "}" */,-21 ),
	/* State 69 */ new Array( 6/* "NIOB" */,-20 , 4/* "OR" */,-20 , 5/* "THEN" */,48 , 13/* "." */,-20 , 19/* "}" */,-20 ),
	/* State 70 */ new Array( 6/* "NIOB" */,-19 , 4/* "OR" */,-19 , 5/* "THEN" */,-19 , 13/* "." */,-19 , 19/* "}" */,-19 ),
	/* State 71 */ new Array( 13/* "." */,-22 , 5/* "THEN" */,-22 , 4/* "OR" */,-22 , 6/* "NIOB" */,-22 , 19/* "}" */,-22 ),
	/* State 72 */ new Array( 13/* "." */,-25 , 5/* "THEN" */,-25 , 4/* "OR" */,-25 , 6/* "NIOB" */,-25 , 19/* "}" */,-25 ),
	/* State 73 */ new Array( 23/* "<-" */,95 , 13/* "." */,-23 , 5/* "THEN" */,-23 , 4/* "OR" */,-23 , 6/* "NIOB" */,-23 , 19/* "}" */,-23 ),
	/* State 74 */ new Array( 31/* "||" */,-34 , 32/* "&&" */,54 , 23/* "<-" */,-34 , 13/* "." */,-34 , 5/* "THEN" */,-34 , 4/* "OR" */,-34 , 6/* "NIOB" */,-34 , 19/* "}" */,-34 , 15/* ")" */,-34 ),
	/* State 75 */ new Array( 14/* "(" */,96 , 23/* "<-" */,-30 , 32/* "&&" */,-30 , 31/* "||" */,-30 , 13/* "." */,-30 , 5/* "THEN" */,-30 , 4/* "OR" */,-30 , 6/* "NIOB" */,-30 , 19/* "}" */,-30 , 15/* ")" */,-30 ),
	/* State 76 */ new Array( 31/* "||" */,-33 , 32/* "&&" */,-33 , 23/* "<-" */,-33 , 13/* "." */,-33 , 5/* "THEN" */,-33 , 4/* "OR" */,-33 , 6/* "NIOB" */,-33 , 19/* "}" */,-33 , 15/* ")" */,-33 ),
	/* State 77 */ new Array( 21/* "<=" */,97 ),
	/* State 78 */ new Array( 14/* "(" */,98 ),
	/* State 79 */ new Array( 31/* "||" */,53 , 32/* "&&" */,54 , 13/* "." */,-27 , 5/* "THEN" */,-27 , 4/* "OR" */,-27 , 6/* "NIOB" */,-27 , 19/* "}" */,-27 ),
	/* State 80 */ new Array( 31/* "||" */,53 , 32/* "&&" */,54 , 13/* "." */,-29 , 5/* "THEN" */,-29 , 4/* "OR" */,-29 , 6/* "NIOB" */,-29 , 19/* "}" */,-29 ),
	/* State 81 */ new Array( 12/* "," */,99 , 15/* ")" */,100 ),
	/* State 82 */ new Array( 15/* ")" */,-37 , 12/* "," */,-37 ),
	/* State 83 */ new Array( 31/* "||" */,53 , 32/* "&&" */,54 , 15/* ")" */,101 ),
	/* State 84 */ new Array( 28/* "Variable" */,102 ),
	/* State 85 */ new Array( 15/* ")" */,103 ),
	/* State 86 */ new Array( 3/* "A" */,-14 , 8/* "PLAYS" */,-14 , 7/* "KNOWS" */,-14 , 9/* "IID" */,-14 , 47/* "$" */,-14 ),
	/* State 87 */ new Array( 3/* "A" */,-15 , 8/* "PLAYS" */,-15 , 7/* "KNOWS" */,-15 , 9/* "IID" */,-15 , 47/* "$" */,-15 ),
	/* State 88 */ new Array( 15/* ")" */,104 ),
	/* State 89 */ new Array( 15/* ")" */,-42 ),
	/* State 90 */ new Array( 15/* ")" */,-43 ),
	/* State 91 */ new Array( 12/* "," */,99 , 15/* ")" */,105 ),
	/* State 92 */ new Array( 47/* "$" */,-4 ),
	/* State 93 */ new Array( 3/* "A" */,11 ),
	/* State 94 */ new Array( 8/* "PLAYS" */,8 , 7/* "KNOWS" */,9 , 9/* "IID" */,10 , 47/* "$" */,-3 ),
	/* State 95 */ new Array( 29/* "Constant" */,75 , 27/* "NOT" */,34 , 28/* "Variable" */,35 ),
	/* State 96 */ new Array( 29/* "Constant" */,41 , 28/* "Variable" */,42 , 25/* "_" */,43 ),
	/* State 97 */ new Array( 3/* "A" */,11 ),
	/* State 98 */ new Array( 29/* "Constant" */,41 , 28/* "Variable" */,42 , 25/* "_" */,43 ),
	/* State 99 */ new Array( 29/* "Constant" */,41 , 28/* "Variable" */,42 , 25/* "_" */,43 ),
	/* State 100 */ new Array( 23/* "<-" */,-31 , 32/* "&&" */,-31 , 31/* "||" */,-31 , 20/* "=>" */,-44 , 21/* "<=" */,-44 ),
	/* State 101 */ new Array( 23/* "<-" */,-32 , 32/* "&&" */,-32 , 31/* "||" */,-32 , 13/* "." */,-32 , 5/* "THEN" */,-32 , 4/* "OR" */,-32 , 6/* "NIOB" */,-32 , 19/* "}" */,-32 , 15/* ")" */,-32 ),
	/* State 102 */ new Array( 26/* "ListBar" */,113 ),
	/* State 103 */ new Array( 13/* "." */,114 ),
	/* State 104 */ new Array( 11/* "::" */,-16 , 13/* "." */,-16 , 23/* "<-" */,-16 , 5/* "THEN" */,-16 , 4/* "OR" */,-16 , 6/* "NIOB" */,-16 , 19/* "}" */,-16 ),
	/* State 105 */ new Array( 12/* "," */,-40 , 15/* ")" */,-40 ),
	/* State 106 */ new Array( 47/* "$" */,-6 ),
	/* State 107 */ new Array( 47/* "$" */,-5 ),
	/* State 108 */ new Array( 31/* "||" */,53 , 32/* "&&" */,54 , 13/* "." */,-24 , 5/* "THEN" */,-24 , 4/* "OR" */,-24 , 6/* "NIOB" */,-24 , 19/* "}" */,-24 ),
	/* State 109 */ new Array( 12/* "," */,99 , 15/* ")" */,115 ),
	/* State 110 */ new Array( 13/* "." */,-26 , 5/* "THEN" */,-26 , 4/* "OR" */,-26 , 6/* "NIOB" */,-26 , 19/* "}" */,-26 ),
	/* State 111 */ new Array( 12/* "," */,99 , 15/* ")" */,116 ),
	/* State 112 */ new Array( 15/* ")" */,-36 , 12/* "," */,-36 ),
	/* State 113 */ new Array( 28/* "Variable" */,117 ),
	/* State 114 */ new Array( 3/* "A" */,-13 , 8/* "PLAYS" */,-13 , 7/* "KNOWS" */,-13 , 9/* "IID" */,-13 , 47/* "$" */,-13 ),
	/* State 115 */ new Array( 23/* "<-" */,-31 , 32/* "&&" */,-31 , 31/* "||" */,-31 , 13/* "." */,-31 , 5/* "THEN" */,-31 , 4/* "OR" */,-31 , 6/* "NIOB" */,-31 , 19/* "}" */,-31 , 15/* ")" */,-31 ),
	/* State 116 */ new Array( 21/* "<=" */,-44 ),
	/* State 117 */ new Array( 17/* "]" */,118 ),
	/* State 118 */ new Array( 23/* "<-" */,-35 , 32/* "&&" */,-35 , 31/* "||" */,-35 , 13/* "." */,-35 , 5/* "THEN" */,-35 , 4/* "OR" */,-35 , 6/* "NIOB" */,-35 , 19/* "}" */,-35 , 15/* ")" */,-35 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 35/* IM */,1 , 33/* Clause_List */,2 , 34/* BuiltIn_List */,3 , 36/* Clause */,5 , 39/* BuiltIn */,6 , 37/* Role */,7 ),
	/* State 1 */ new Array(  ),
	/* State 2 */ new Array( 34/* BuiltIn_List */,13 , 39/* BuiltIn */,6 ),
	/* State 3 */ new Array( 33/* Clause_List */,14 , 36/* Clause */,5 , 37/* Role */,7 ),
	/* State 4 */ new Array(  ),
	/* State 5 */ new Array( 33/* Clause_List */,16 , 36/* Clause */,5 , 37/* Role */,7 ),
	/* State 6 */ new Array( 34/* BuiltIn_List */,17 , 39/* BuiltIn */,6 ),
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
	/* State 19 */ new Array( 38/* Def */,26 , 43/* Interaction */,27 , 44/* Message */,29 , 45/* Constraint */,30 , 37/* Role */,32 ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array(  ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array( 40/* Type */,39 , 42/* Term */,40 ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array(  ),
	/* State 26 */ new Array(  ),
	/* State 27 */ new Array(  ),
	/* State 28 */ new Array( 38/* Def */,50 , 43/* Interaction */,27 , 44/* Message */,29 , 45/* Constraint */,30 , 37/* Role */,32 ),
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
	/* State 46 */ new Array( 38/* Def */,68 , 43/* Interaction */,27 , 44/* Message */,29 , 45/* Constraint */,30 , 37/* Role */,32 ),
	/* State 47 */ new Array( 38/* Def */,69 , 43/* Interaction */,27 , 44/* Message */,29 , 45/* Constraint */,30 , 37/* Role */,32 ),
	/* State 48 */ new Array( 38/* Def */,70 , 43/* Interaction */,27 , 44/* Message */,29 , 45/* Constraint */,30 , 37/* Role */,32 ),
	/* State 49 */ new Array(  ),
	/* State 50 */ new Array(  ),
	/* State 51 */ new Array( 37/* Role */,72 ),
	/* State 52 */ new Array( 37/* Role */,73 ),
	/* State 53 */ new Array( 45/* Constraint */,74 ),
	/* State 54 */ new Array( 45/* Constraint */,76 ),
	/* State 55 */ new Array( 44/* Message */,77 ),
	/* State 56 */ new Array( 45/* Constraint */,79 ),
	/* State 57 */ new Array( 45/* Constraint */,80 ),
	/* State 58 */ new Array( 46/* Terms */,81 , 42/* Term */,82 ),
	/* State 59 */ new Array( 45/* Constraint */,83 ),
	/* State 60 */ new Array(  ),
	/* State 61 */ new Array(  ),
	/* State 62 */ new Array(  ),
	/* State 63 */ new Array(  ),
	/* State 64 */ new Array( 41/* Id */,88 ),
	/* State 65 */ new Array( 46/* Terms */,91 , 42/* Term */,82 ),
	/* State 66 */ new Array(  ),
	/* State 67 */ new Array( 34/* BuiltIn_List */,93 , 33/* Clause_List */,94 , 36/* Clause */,5 , 39/* BuiltIn */,6 , 37/* Role */,7 ),
	/* State 68 */ new Array(  ),
	/* State 69 */ new Array(  ),
	/* State 70 */ new Array(  ),
	/* State 71 */ new Array(  ),
	/* State 72 */ new Array(  ),
	/* State 73 */ new Array(  ),
	/* State 74 */ new Array(  ),
	/* State 75 */ new Array(  ),
	/* State 76 */ new Array(  ),
	/* State 77 */ new Array(  ),
	/* State 78 */ new Array(  ),
	/* State 79 */ new Array(  ),
	/* State 80 */ new Array(  ),
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
	/* State 93 */ new Array( 33/* Clause_List */,106 , 36/* Clause */,5 , 37/* Role */,7 ),
	/* State 94 */ new Array( 34/* BuiltIn_List */,107 , 39/* BuiltIn */,6 ),
	/* State 95 */ new Array( 45/* Constraint */,108 ),
	/* State 96 */ new Array( 46/* Terms */,109 , 42/* Term */,82 ),
	/* State 97 */ new Array( 37/* Role */,110 ),
	/* State 98 */ new Array( 46/* Terms */,111 , 42/* Term */,82 ),
	/* State 99 */ new Array( 42/* Term */,112 ),
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
	/* State 114 */ new Array(  ),
	/* State 115 */ new Array(  ),
	/* State 116 */ new Array(  ),
	/* State 117 */ new Array(  ),
	/* State 118 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"IM'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"HEAD" /* Terminal symbol */,
	"A" /* Terminal symbol */,
	"OR" /* Terminal symbol */,
	"THEN" /* Terminal symbol */,
	"NIOB" /* Terminal symbol */,
	"KNOWS" /* Terminal symbol */,
	"PLAYS" /* Terminal symbol */,
	"IID" /* Terminal symbol */,
	"NULL" /* Terminal symbol */,
	"::" /* Terminal symbol */,
	"," /* Terminal symbol */,
	"." /* Terminal symbol */,
	"(" /* Terminal symbol */,
	")" /* Terminal symbol */,
	"[" /* Terminal symbol */,
	"]" /* Terminal symbol */,
	"{" /* Terminal symbol */,
	"}" /* Terminal symbol */,
	"=>" /* Terminal symbol */,
	"<=" /* Terminal symbol */,
	"->" /* Terminal symbol */,
	"<-" /* Terminal symbol */,
	"=" /* Terminal symbol */,
	"_" /* Terminal symbol */,
	"ListBar" /* Terminal symbol */,
	"NOT" /* Terminal symbol */,
	"Variable" /* Terminal symbol */,
	"Constant" /* Terminal symbol */,
	"JSON" /* Terminal symbol */,
	"||" /* Terminal symbol */,
	"&&" /* Terminal symbol */,
	"Clause_List" /* Non-terminal symbol */,
	"BuiltIn_List" /* Non-terminal symbol */,
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
		act = 120;
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
		if( act == 120 )
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
			
			while( act == 120 && la != 47 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery\n" +
									"Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
									"Action: " + act + "\n\n" );
				if( la == -1 )
					info.offset++;
					
				while( act == 120 && sstack.length > 0 )
				{
					sstack.pop();
					vstack.pop();
					
					if( sstack.length == 0 )
						break;
						
					act = 120;
					for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
					{
						if( act_tab[sstack[sstack.length-1]][i] == la )
						{
							act = act_tab[sstack[sstack.length-1]][i+1];
							break;
						}
					}
				}
				
				if( act != 120 )
					break;
				
				for( var i = 0; i < rsstack.length; i++ )
				{
					sstack.push( rsstack[i] );
					vstack.push( rvstack[i] );
				}
				
				la = __NODEJS_lex( info );
			}
			
			if( act == 120 )
			{
				if( NODEJS__dbg_withtrace )
					__NODEJS_dbg_print( "\tError recovery failed, terminating parse process..." );
				break;
			}


			if( NODEJS__dbg_withtrace )
				__NODEJS_dbg_print( "\tError recovery succeeded, continuing" );
		}
		
		/*
		if( act == 120 )
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
		 rval = createNode(NODE_OP, OP_CONSTRAINT, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 32:
	{
		 rval = createNode(NODE_OP, OP_NEGATE, vstack[ vstack.length - 2 ]); 
	}
	break;
	case 33:
	{
		 rval = createNode(NODE_OP, OP_LOGAND, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 34:
	{
		 rval = createNode(NODE_OP, OP_LOGOR, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 35:
	{
		 rval = createNode(NODE_OP, OP_LIST, vstack[ vstack.length - 7 ], vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 36:
	{
		 rval = createNode(NODE_OP, OP_TERMS, vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 37:
	{
		 rval = createNode(NODE_OP, OP_TERMS, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 38:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 39:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 40:
	{
		 rval = createNode(NODE_OP, OP_FACTOR, vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ])
	}
	break;
	case 41:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 42:
	{
		 rval = createNode(NODE_CONST, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 43:
	{
		 rval = createNode(NODE_VAR, vstack[ vstack.length - 1 ]); 
	}
	break;
	case 44:
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

