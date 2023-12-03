// if (typeof require != "undefined") { ///no NWJS e no Electron, vai acabar declarando esses objetos como globais
if (typeof window == "undefined") { //roda no node sob require, mas nao em browser ou NWjs; mesmo assim, vai acabar declarando esses objetos como globais
	var mysql = require("mysql");
	var moment = require("moment");
	
	var fs = require("fs");
	var {exec} = require("child_process");
}

const mainlib = {
	//mapProperties(objArr, propsArr) ////substituido por function do lodash
	
	assign(dest, src, propsArr) { //atribui a objeto algumas propriedades do outro
		if (!propsArr) propsArr = Object.keys(src); //undefined ou null copia tudo, [] copia nada
		
		propsArr.forEach(m => dest[m] = src[m]);
		
		return dest;
	},
	
	async waitFor(testFunc, taskFunc, interval = 100) { //espera condicao verdadeira para rodar function
		while (!testFunc()) {
			await this.sleep(interval);
		}
		taskFunc();
	},
	
	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},
	
	nowMeuFuso() {
		return moment.utc().add(-3, "h").format("YYYY-MM-DD HH:mm:ss");
	},
	
	check(funcAndObjArr, finalFunc) { //retorna primeiro objeto cuja function der true para rodar finalFunc; pode retornar da pilha com throw
		for (var i = 0; i < funcAndObjArr.length; i+=2) {
			var funcOrBoolean = funcAndObjArr[i];
			var ehEsseCaso = typeof funcOrBoolean == "function" ? funcOrBoolean() : funcOrBoolean; //aceita boolean ou function para rodar na hora da checagem
			
			if (ehEsseCaso) {
				var retObj = funcAndObjArr[i + 1];
				if (finalFunc) finalFunc(retObj);
				// throw retObj; eu mesmo posso dar throw dentro da finalFunc
				return retObj;
			}
		}
	},
	
	// randomInt(upperLimit) {
		// return Math.floor(upperLimit*Math.random());
	// },
	
	
	limita(str, n) {
		return str ? str.slice(0, n) : "";
	},
	
	/*
	promises(...funcs) { //deprecated: use async-await
		var prom = new Promise(function(resolve, reject) {
			funcs[0](resolve, reject);
		});
		for (let i = 1; i < funcs.length; i++) {
			prom = prom.then(function(result) {return new Promise(function(resolve, reject) {
				funcs[i](resolve, reject, result);
			});});
		}
	},
	
	promisesWithCatch(...funcs) { //deprecated: use async-await
		var prom = new Promise(function(resolve, reject) {
			funcs[0](resolve, reject);
		});
		for (let i = 1; i < funcs.length - 1; i++) {
			prom = prom.then(function(result) {return new Promise(function(resolve, reject) {
				funcs[i](resolve, reject, result);
			});});
		}
		prom = prom.catch(function(error) {return new Promise(function(resolve, reject) {
			funcs[funcs.length - 1](error);
		});});
	},
	*/
	
	stringifyWithFunctions(json) { //faz string evalable de objeto que inclui functions dele
		function stringifyFunctionsRecursivo(json) {
			for (var m in json) {
				var v = json[m];
				var type = typeof v;
				
				if (type == "function") {
					var toStr = v.toString();
					// str = str.replace(":" + JSON.stringify(toStr), ":" + toStr); //aproveitando que aspa sem \ antes soh existe para envolver valores
					
					var strFunc = JSON.stringify(toStr);
					str = str.replace(":" + strFunc, ":" + toStr); //aproveitando que aspa sem \ antes soh existe para envolver valores
					
					//function dentro de array tem forma de substituir diferente:
					str = str.replace("[" + strFunc, "[" + toStr);
					str = str.replace("," + strFunc, "," + toStr);
				} else if (type == "object") { //array eh object e isso resolve para ser recursivo
					stringifyFunctionsRecursivo(v);
				}
			}
		}
		
		var str = JSON.stringify(json, function(key, val) {
			return (typeof val == "function") ? val.toString() : val;
		});
		
		stringifyFunctionsRecursivo(json);
		
		return str;
	},
	
	parseObj(str, pairSeparator, keyValueSeparator) { //faz objeto a partir de string com separadores de pares keyValue
		var pairArr = str.split(pairSeparator);
		var obj = {};
		pairArr.forEach(pair => {
			var [key, value] = pair.split(keyValueSeparator);
			obj[key] = value;
		});
		return obj;
	},
	
	sortArraysPeloPrimeiro(sortFunc, ...arrays) { //sort todos os arrays com base no primeiro; devem ter length igual; retorna arrays num outro array
		var length = arrays[0].length;
		var nArrays = arrays.length;
		
		var blockArr = [];
		for (var i = 0; i < length; i++) {
			var block = [];
			for (var a = 0; a < nArrays; a++) {
				block.push(arrays[a][i]);
			}
			blockArr.push(block);
		}
		
		blockArr.sort(function(b1, b2) {
			return sortFunc(b1[0], b2[0]);
		});
		
		for (var a = 0; a < nArrays; a++) {
			arrays[a] = blockArr.map(block => block[a]);
		}
		
		return arrays;
	},
	
	valida(elem, validaInfo) {
		if (elem instanceof Array) { //SE foi mandado array [field, value] (usado no node)
			var [field, value] = elem;
		} else { //SE nao: assume que eh elemento HTML (usado no browser)
			var field = elem.dataset.field;
			var value = elem.getValue();
		}
		var info = validaInfo[field];
		
		if (info) { //SE tem info de validacao para esse field
			if (typeof info == "function") { //SE eh function
				return info(value, elem);
			} else { //SE nao: assume que eh array de functions e msgs; function dar true significa mostrar erro da mensagem
				for (var [func, msg] of info) {
					if (func(value)) {
						return msg;
					}
				}
			}
		}
		
		return ""; //"" significa que eh valido
	},
	
	
	//trocar formato entre array de dbe's e array de arrays de fields:
	dbeToArrs(dbeArr) {
		var fields = [];
		for (var field in dbeArr[0]) {
			fields.push(field);
		}
		
		var rows = [];
		for (var i = 0; i < dbeArr.length; i++) {
			var dbe = dbeArr[i];
			var dba = [];
			for (var field of fields) {
				dba.push(dbe[field]);
			}
			rows.push(dba);
		}
		
		return {fields, rows};
	},
	
	dbeToObjs(dbaArr) {
		var {fields, rows} = dbaArr;
		
		var dbeArr = [];
		for (var i = 0; i < rows.length; i++) {
			var dba = rows[i];
			var dbe = {};
			for (var f = 0; f < fields.length; f++) {
				dbe[fields[f]] = dba[f];
			}
			dbeArr.push(dbe);
		}
		
		return dbeArr;
	},
	
	
	registraOn(obj, eventInfo) {
		for (var eventName in eventInfo) {
			var func = eventInfo[eventName];
			obj.on(eventName, func);
		}
	},
	
	
	
	
	//==========functions para usar no server:
	
	//functions que criam array [queryString, valuesArr] para usar no connection.query:
	sqlSelect(...arr) {
		var qs = [];
		var vs = [];
		
		for (var elem of arr) {
			if (typeof elem == "string") {
				qs.push(elem);
			} else { //assume que eh array
				vs.push(...elem); //appenda cada elemento no final
			}
		}
		
		return [qs.join(";"), vs];
	},
	
	sqlInsert(table, data) {
		var q = "INSERT INTO " + table + " SET ?";
		return [q, data];
	},
	
	sqlInsertMulti(table, dataArr) { //array deve ter os mesmos membros em todos os objetos
		var valoresArr = [];
		var interrogacaoArr = [];
		for (var i = 0; i < dataArr.length; i++) {
			var data = dataArr[i];
			var ks = Object.keys(data); ///e se ordem mudar por algum motivo em algum elemento?
			var vs = Object.values(data);
			
			valoresArr.push(...vs);
			interrogacaoArr.push("(" + ks.map(x => "?").join(",") + ")");
		}
		
		var q = "INSERT INTO " + table + " (" + ks.join(",") + ") VALUES " + interrogacaoArr.join(",");
		return [q, valoresArr];
	},
	
	sqlUpdate(table, data, whereStr, whereArr) { //whereStr pode ter varios '?' e whereArr tem seus valores
		var q = "UPDATE " + table + " SET ? WHERE " + whereStr;
		return [q, [data].concat(whereArr)];
	},
	
	sqlInsertOrUpdate(table, data) { //tenta inserir e faz update se for duplicar
		var q = "INSERT INTO " + table + " SET ? ON DUPLICATE KEY UPDATE ?";
		return [q, [data, data]];
	},
	
	sqlJoin(t1, ...arr) { //ex: sqlJoin("alunos", ["temas", "id_tema", "alunos.id_tema"], ["modulos", "id_modulo", "alunos.id_modulo"])
		var ret = t1;
		
		for (var i = 0; i < arr.length; i++) {
			var [t2, f2, tf] = arr[i];
			ret += " INNER JOIN " + t2 + " ON " + t2 + "." + f2 + "=" + tf;
		}
		
		return ret;
	},
	
	//de db query:
	queryPromise(connection, query, params) {
		return new Promise((resolve, reject) => {
			var q = connection.query(query, params, function(error, results, fields) {
				if (error) {
					console.log(error);
					reject(error); //equivalente ao throw
				}
				resolve(results);
			});
			
			// console.log(q.sql);
		});
	},
	
	async commitQueries(connection, queryInfoArr) { //queryInfoArr eh array de arrays do tipo [query, params]
		var resultsArr = [];
		// connection.query("BEGIN");
		try {
			connection.query("BEGIN");
			for (let queryInfo of queryInfoArr) {
				let result = await this.queryPromise(connection, ...queryInfo);
				resultsArr.push(result);
			}
			connection.query("COMMIT");
			return resultsArr;
		} catch (ex) {
			// console.log("commitQueries ex:", ex);
			if (ex.code == "ENOTFOUND" || ex.code == "ETIMEDOUT") { //SE nao achou o db
				// return ex;
				throw ex;
			} else { //SE foi erro em query
				connection.query("ROLLBACK");
				// return ex;
				throw ex;
			}
		}
	},
	
	isDbError(resultsOrError) {
		return "code" in resultsOrError;
	},
	
	statusFromDbError(err) {
		return ["ENOTFOUND", "ETIMEDOUT"].includes(err.code) ? 502 : 500;
	},
	
	sendDefault(res, resultsOrError, sendIfOk, sendIfError) {
		if (this.isDbError(resultsOrError)) { //SE deu erro
			// console.log("sendDefault erro:", resultsOrError);
			var status = this.statusFromDbError(resultsOrError);
			res.status(status).send(sendIfError !== undefined ? sendIfError : resultsOrError);
			
			// fs.promises.writeFile("C:/Users/Eduardo/Desktop/sd.txt", resultsOrError.toString() + resultsOrError.stack);
		} else {
			res.send(sendIfOk !== undefined ? sendIfOk : resultsOrError);
		}
	},
	
	//session-soft:
	setSessionSoft(res, obj, cookieProps) { //cookie lado a lado com session para browser saber se estah logado e pegar info non-sensitive
		res.cookie("session.soft", JSON.stringify(obj), cookieProps);
	},
	
	renewSessionSoft(req, res, cookieProps) {
		res.cookie("session.soft", req.cookies["session.soft"], cookieProps);
	},
	
	clearSessionSoft(res) {
		res.clearCookie("session.soft");
	},
	
	
	//db-timestamp:
	/*USO:
		var isToQuery = await mainlib.dbTimestampCheck(req, res, connection, "TABLE_SCHEMA='ogp4' AND TABLE_NAME IN('teste_db_timestamp','contatos')");
		
		if (isToQuery) {
			var results = await mainlib.queryPromise(connection, "SELECT * FROM teste_db_timestamp WHERE id=1").catch(err => err);
			mainlib.sendDefault(res, results);
		} else {
			res.status(304).end();
		}
	*/
	async dbTimestampCheck(req, res, connection, sqlWhere) { //function para checar se tem mudanca nas dbTables antes de fazer a query
		var clientDbTimestamp = req.get("db-timestamp");
		
		//pega ultimo timestamp das tabelas usadas na query:
		var results = await this.queryPromise(connection, "SELECT MAX(UPDATE_TIME) AS last FROM information_schema.tables WHERE " + sqlWhere).catch(err => err);
		var dbTimestamp = moment(results[0].last).format("YYYY-MM-DD HH:mm:ss");
		
		res.set("db-timestamp", dbTimestamp); //side-effect
		
		// console.log("cli:", clientDbTimestamp, "db:", dbTimestamp);
		
		var isToQuery = false;
		if (clientDbTimestamp) { //SE browser enviou timestamp
			if (dbTimestamp == clientDbTimestamp) {
				
			} else {
				isToQuery = true;
			}
		} else { //SE nao
			isToQuery = true;
		}
		
		console.log(isToQuery? "db" : "cl", "\t", "db", dbTimestamp, "cl", clientDbTimestamp);
		
		return isToQuery;
	},
	
	
	async syncPieces(res, connection, infoArr, allowedTables, id_usuario, isToGetConflitos) {
		//ve se tem permissao em todas as tables enviadas:
		for (var info of infoArr) {
			var dbTable = info.name;
			if (!allowedTables.includes(dbTable)) {
				res.status(403).send("sem permissao para tabela " + dbTable); return;
			}
		}
		//CONTINUA: tem permissao
		
		var resultsArr = [];
		
		for (var info of infoArr) {
			var dbTable = info.name;
			var {lastSyncTimestamp, pieces} = info;
			var agora = (new Date()).getTime();
			
			//faz select no inicio mas envia no final:
			if (id_usuario) {
				var resultsPromise = this.queryPromise(connection, "SELECT cid, prop, value FROM " + dbTable + " WHERE mtime>? AND id_usuario=?", [lastSyncTimestamp, id_usuario]).catch(err => err);
			} else {
				var resultsPromise = this.queryPromise(connection, "SELECT cid, prop, value FROM " + dbTable + " WHERE mtime>?", [lastSyncTimestamp]).catch(err => err);
			}
			
			//poe timestamp nos enviados:
			if (id_usuario) {
				pieces.forEach(dbe => {
					dbe.mtime = agora;
					dbe.id_usuario = id_usuario;
				});
			} else {
				pieces.forEach(dbe => {
					dbe.mtime = agora;
				});
			}
			
			var results = await resultsPromise; //termina de esperar
			
			if (this.isDbError(results)) {
				resultsArr.push({
					name: dbTable,
					erro: results,
				});
				continue;
			}
			//CONTINUA: nao deu erro
			
			//nao enviar de volta o que acabou de receber, pois foi sobrescrito:
			if (results.length > 0 && pieces.length > 0) { //SE pode ter interseccao
				var resultsSemEnviados = results.filter(pieceDb => !pieces.find(pieceNew => pieceNew.cid == pieceDb.cid && pieceNew.prop == pieceDb.prop));
				
				//detecta conflitos:
				if (isToGetConflitos) {
					var conflitos = []; //array de dbes (semiPieces) com os valores que estavam no db
					for (var semiPiece of results) {
						var pieceNew = pieces.find(pieceNew => pieceNew.cid == semiPiece.cid && pieceNew.prop == semiPiece.prop);
						if (pieceNew && pieceNew.value != semiPiece.value) { //SE db tinha valor diferente que ia mandar pro browser
							conflitos.push(semiPiece);
						}
					}
				}
			} else {
				var resultsSemEnviados = results;
			}
			
			//nao faz update de props de deletados:
			var deletados = resultsSemEnviados.filter(pieceDb => pieceDb.prop === null).map(pieceDb => pieceDb.cid + ""); //faz virar string para depois comparar, pois .includes nao dah type coerce
			pieces = pieces.filter(dbe => !deletados.includes(dbe.cid));
			
			var queryInfoArr = pieces.map(dbe => ["INSERT INTO " + dbTable + " SET ? ON DUPLICATE KEY UPDATE ?", [dbe, dbe]]);
			var resultsDbSave = await this.commitQueries(connection, queryInfoArr);
			
			if (this.isDbError(resultsDbSave)) {
				resultsArr.push({
					name: dbTable,
					erro: resultsDbSave,
				});
			} else {
				resultsArr.push({
					name: dbTable,
					lastSyncTimestamp: agora,
					newPieces: resultsSemEnviados,
					conflitos,
				});
			}
		}
		
		res.send({
			resultsArr,
		});
	},
	
	
	
	
	
	
	
	//de dev:
	showStackTraceNotification(title, msg, type) {
		var electronPath = "C:/Users/Eduardo/node_modules/electron/dist/electron.exe";
		var pasta = "C:/Users/Eduardo/Documents/Meus Programas/html notification";
		var timestamp = (new Date()).getTime();
		
		var json = {
			title,
			stack: msg,
			type,
		};
		fs.promises.writeFile(pasta + "/" + timestamp + ".html", JSON.stringify(json)); //manda dados por arquivo
		
		var electronProcess = exec(electronPath + ' "' + pasta + '" "' + timestamp + '"'); //manda timestamp para poder pegar arquivo
	},
	
};

// if (typeof exports != "undefined") {
if (typeof window == "undefined") { //roda no node sob require, mas nao em browser ou NWjs
	module.exports = mainlib;
}