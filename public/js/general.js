const gen = {
	parseGet(url) { //analisa url e separa endereco dos parametros do get
		url = url || window.location.href; //se nao mandou nada: pega por padrao o endereco da pagina atual
		
		var [address, params = ""] = url.split("?");
		
		var paramsSplit = params.split("&");
		
		var ret = {};
		for (var i = 0; i < paramsSplit.length; i++) {
			var atrib = paramsSplit[i];
			var [param, value] = atrib.split("=");
			ret[param] = decodeURI(value);
		}
		
		return {
			address: address,
			params: ret
		};
	},
	
	isMobile() {
		return ("ontouchstart" in window);
	},
	
	isIphone() {
		return navigator.userAgent.includes("iPhone");
	},
	
	isPWA() {
		return !!window.matchMedia('(display-mode: standalone)').matches;
	},
	
	isLocalhost() {
		return this.parseGet().address.indexOf("://localhost/") > -1;
	},
	
	travaInputs(parent) { //para impedir user de modificar campos jah enviados pensando que vai mudar algo
		parent.addEventListener("focusin", function(ev) { //para impedir foco por tab
			ev.target.blur();
		});
		
		parent.style["pointer-events"] = "none";
	},
	
	//comunicacao inter-paginas:
	/* USO:
		window.location.href = "/list?mod=pacientes&npi=" + JSON.stringify({
			defaultInsertValues: {
				id_tipo: 2,
			},
		});
	*/
	newPageInfoGet() { //pega dados que podem ter sido enviados para essa pagina
		var url = new URL(window.location.href);
		var npiStr = url.searchParams.get("npi");
		
		if (npiStr) { //SE foi mandado por get parameter
			url.searchParams.delete("npi");
			console.log(url.toString());
			history.replaceState({}, "", url.toString());
			
			var key = url.pathname + url.search;
			sessionStorage.setItem(key, npiStr); //guarda para reloads
			
			return JSON.parse(npiStr);
		} else { //SE nao tem: ve nos storages
			var key = url.pathname + url.search;
			var value = localStorage.getItem(key);
			var value2 = sessionStorage.getItem(key);
			
			if (value) { //SE foi enviado pelo localStorage
				localStorage.removeItem(key);
				sessionStorage.setItem(key, value); //guarda para reloads
				
				return JSON.parse(value);
			} else if (value2) { //SE estah no sessionStorage
				//limpa se mudar de pagina:
				for (var key2 in sessionStorage) {
					if (key2 != key) {
						sessionStorage.removeItem(key2);
					}
				}
				// console.log(Object.keys(sessionStorage));
				
				return JSON.parse(value2);
			} else {
				return {};
			}
		}
	},
	
	newPageInfoSet(nextPagina, obj) { //registra para abrir depois
		var key = nextPagina;
		obj.referer = window.location.href;
		obj.timestamp = (new Date).getTime();
		localStorage.setItem(key, JSON.stringify(obj));
	},
	
	newPageInfoOpen(nextPagina, obj) { //envia obj e abre pagina
		this.newPageInfoSet(nextPagina, obj);
		window.location.href = nextPagina;
	},
	
	newPageInfoOpenNewTab(nextPagina, obj) { //abre pagina em outra aba
		this.newPageInfoSet(nextPagina, obj);
		window.open(nextPagina);
	},
	
	newPageInfoUrl(nextPagina, obj) { //cria url da pagina com obj nos parametros get
		var url = new URL(nextPagina);
		url.searchParams.set("npi", JSON.stringify(obj));
		return decodeURI(url.pathname + url.search);
	},
	
	//relacionados ao sw:
	showNotification(options) {
		Notification.requestPermission(function(result) {
			if (result == "granted") {
				navigator.serviceWorker.ready.then(function(registration) {
					registration.showNotification(options.title, options);
				});
			}
		});
	},
	
	async sendLogsAoSair(name) {
		window.addEventListener("visibilitychange", async ev => {
			if (document.visibilityState == "hidden") {
				this.sendLogs(name);
			}
		});
	},
	
	async sendLogs(name) {
		var logStore = localforage.createInstance({ //armazenamento de paginas acessadas
		    driver: [localforage.INDEXEDDB],
			name,
			storeName: "pages",
		});
		
		var pages = [];
		await logStore.iterate((page, key, i) => {
			pages.push(page);
		});
		
		if (pages.length > 0) {
			var mandou = helpers.ajaxBeacon("/api/log", {pages});
			if (mandou) {
				logStore.clear();
			}
		}
	},
	
	registraSw() {
		navigator.serviceWorker.register("/sw.js").then(async function(registration) {
			console.log("ServiceWorker registration successful with scope:", registration.scope);
			swTimestampStore.setItem("sw", (new Date()).getTime());
			isSwRegistered = true;
			
			// gen.registraSyncLogs(registration);
		}).catch(function(err) {
			console.log("ServiceWorker registration failed:", err);
		});
	},
	
	async registraSwMaybe(registrations) {
		if (this.isLocalhost()) {
			this.registraSw();
		} else if (registrations.length > 0) { //SE ja tem: espera antes de checar por sw novo
			var swActivateTimestamp = await swTimestampStore.getItem("sw");
			var agora = (new Date()).getTime();
			// console.log("tempo desde ultimo sw-activate:", agora - swActivateTimestamp);
			
			if (swActivateTimestamp && agora - swActivateTimestamp > swUpdateMs) { //SE faz tempo que registrou sw
				this.registraSw();
			}
		} else {
			this.registraSw();
		}
	},
	
	swMessage(ev) {
		var detail = ev.detail;
		
		//avisa se tem nova versao:
		if (isAdmin && detail.tag == "new-version") {
			hoverMessage("Nova\nVersão", {"background-color": "#0F0"}, 3000, 1000);
		}
		
		if (detail.tag == "dev") {
			if (!isSwRegistered) this.registraSw();
			// hoverMessage("Modo\nDev", {"background-color": "#0F0"}, 3000, 1000);
		} else if (detail.tag == "dev-until") {
			hoverMessage("Modo\nDev\nAtivado", {"background-color": "#0F0"}, 3000, 1000);
		}
		
		//avisa se deu erro no server:
		if (isAdmin && detail.body) {
			var err = detail.body;
			try {
				var jsonErr = JSON.parse(err);
			} catch (ex) {
				
			}
			console.warn(jsonErr || err);
			hoverMessage("\n\n\n\nERRO!\n" + detail.url + "\n" + detail.status + "\n" + err, {"background-color": "#F00"}, 12000, 3000);
		}
		
		//avisos padrao para todos os usuarios:
		if (detail.method == "POST") {
			gen.avisosDefaultSaida(detail);
		} else {
			gen.avisosDefaultEntrada(detail);
		}
	},
	
	//de master ou uso unico:
	firstVisit() {
		var cookie = Cookies.get("first");
		// console.log(cookie);
		if (cookie === undefined) {
			Cookies.set("first", mainlib.nowMeuFuso(), {sameSite: "strict", expires: 10*365});
		}
	},
	
	sessionSoft() {
		var valor = Cookies.get("session.soft");
		// console.log("sessionSoft:", valor);
		return valor ? JSON.parse(valor) : {};
	},
	
	logReferer() { //loga se veio de pagina externa; no firefox o referrer eh sempre ""
		var ref = document.referrer;
		if (ref) {
			console.log("referer:", ref);
			var host = (new URL(window.location)).origin;
			if (!ref.startsWith(host)) { //SE veio de outro site
				var pages = [{
					url: window.location.pathname,
					data_hora: moment().format("YYYY-MM-DD HH:mm:ss"),
					referer: ref,
				}];
				
				helpers.ajaxPost("/api/log", {pages});
			}
		}
	},
	
	avisosDefaultEntrada(detail) {
		if (detail.status == 401) {
			hoverMessage("Sem login ativo.", {"background-color": "#FF0"});
		} else if (detail.status == 403) {
			hoverMessage("Sem permissão.", {"background-color": "#FF0"});
		} else if (detail.status == 404) {
			hoverMessage("Rota inexistente.", {"background-color": "#FF0"});
		} else if (detail.status == 500) {
			hoverMessage("Erro. Problemas no SQL.\nExibindo dados de " + moment(detail.timestamp).format("DD/MM HH:mm") + ".", {"background-color": "#FF0"});
		} else if (detail.status == 502) {
			hoverMessage("Erro. Sem banco de dados.\nExibindo dados de " + moment(detail.timestamp).format("DD/MM HH:mm") + ".", {"background-color": "#FF0"});
		} else if (detail.status == 0) {
			hoverMessage("Erro. Sem conexão.\nExibindo dados de " + moment(detail.timestamp).format("DD/MM HH:mm") + ".", {"background-color": "#FF0"});
		} else if (detail.status == -1) {
			hoverMessage("Erro. Sem conexão e sem cache.", {"background-color": "#FF0"});
		} else if (detail.status >= 400) {
			console.log(detail.url);
			hoverMessage("Erro não catalogado.\nNúmero " + detail.status, {"background-color": "#FF0"});
		}
	},
	
	avisosDefaultSaida(detail) {
		if (detail.status == 401) {
			hoverMessage("Erro no envio. Sem login ativo.", {"background-color": "#FF0"});
		} else if (detail.status == 403) {
			hoverMessage("Erro no envio. Sem permissão.", {"background-color": "#FF0"});
		} else if (detail.status == 404) {
			hoverMessage("Erro no envio. Rota inexistente.", {"background-color": "#FF0"});
		} else if (detail.status == 406) {
			hoverMessage("Erro no envio. Dados inválidos não puderam ser enviados.", {"background-color": "#FF0"});
		} else if (detail.status == 500) {
			hoverMessage("Erro no envio. Problemas no SQL.", {"background-color": "#FF0"});
		} else if (detail.status == 502) {
			hoverMessage("Erro no envio. Sem banco de dados.\nTente novamente mais tarde.", {"background-color": "#FF0"});
		} else if (detail.status == 0) {
			hoverMessage("Erro no envio. Sem conexão.\nTente novamente mais tarde.", {"background-color": "#FF0"});
		} else if (detail.status >= 400) {
			console.log(detail.url);
			hoverMessage("Erro de envio não catalogado.\nNúmero " + detail.status, {"background-color": "#FF0"});
		}
	},
	
	getCurrUserId() { //para nao misturar armazenamento offline de users deslogados que usarem o mesmo dispositivo
		return localStorage.getItem("currUserId");
	},
	
	setCurrUserId(id) {
		localStorage.setItem("currUserId", id);
	},
	
	siteStoreInstance(siteName) {
		var siteStore = localforage.createInstance({
			driver: [localforage.INDEXEDDB],
			name: siteName,
			storeName: "user_" + this.getCurrUserId(),
		});
		
		return siteStore;
	},
	
	async persistData() {
		if (navigator.storage && navigator.storage.persist) {
			var result = await navigator.storage.persist();
			console.log("storage.persist:", result);
		}
	},
	
	siteStylePriority() { //move site.css pro final pra ter prioridade nos seletores iguais; mas deixa antes dos styles da pagina
		// document.body.append(siteStyle);
		// document.head.append(siteStyle);
		document.head.qsa("link[rel=stylesheet]").at(-1).after(siteStyle);
	},
	
	prepareInstallPwaButton(button) { //poe acao de instalar pwa em button
		window.addEventListener("beforeinstallprompt", ev => {
			ev.preventDefault(); // Prevent Chrome 67 and earlier from automatically showing the prompt
			var deferredPrompt = ev;
			button.style.display = ""; //button deve comecar invisivel na pagina
		
			button.addEventListener("click", async ev2 => { //parece que prompt padrao volta depois de um tempo apos nao apertar botao
				button.style.display = "none";
				deferredPrompt.prompt(); // Show the install prompt
				
				var choiceResult = await deferredPrompt.userChoice;
				if (choiceResult.outcome == "accepted") {
					console.log("User accepted the A2HS prompt");
				} else {
					console.log("User dismissed the A2HS prompt");
				}
				deferredPrompt = null;
			});
		});
	},
	
	//viewport e zoom
	zoomOutMobile() { //nao funciona direito
		var metaViewport = document.head.querySelector("meta[name=viewport]");
		var content = metaViewport.content;
		var minZoom = content.match(/minimum-scale=(.*?)(?:,|$)/)[1];
		var newContent = content.replace(/initial-scale=(.*?),/, "initial-scale=" + minZoom + ","); //CUIDADO: tem q ter virgula depois da propriedade!
		metaViewport.content = newContent;
	},
	
	getViewportWinSize() {
		var bottomRightRef = document.body.createAppend("div", {}, {position: "fixed", right: 0, bottom: 0, opacity: 0, "pointer-events": "none"});
		var [winX, winY] = [bottomRightRef.offsetLeft + bottomRightRef.offsetWidth, bottomRightRef.offsetTop + bottomRightRef.offsetHeight]; //usava window.innerWidth e window.innerHeight quando era soh para Android
		bottomRightRef.remove();
		return [winX, winY];
	},
	
	viewportStick(elem, centraliza, reaparecerMs = 500) { //recebe elemento fixed e gruda no viewport; pode receber outras formas de centralizar, por exemplo embaixo da tela
		var pending = false;
		
		var defaultFuncs = { //grudadores de viewport padrao chamar
			//precisa do transform-origin porque scale eh em relacao ao centro por padrao
			
			up(elem) { //em cima, como a barra do iFood
				var [dx, dy] = [visualViewport.offsetLeft, visualViewport.offsetTop];
				elem.style.transform = "translate(" + dx + "px, " + dy + "px)";
				elem.style.width = visualViewport.width + "px";
			},
			
			upRight(elem) {
				var [winX, winY] = gen.getViewportWinSize();
				var [dx, dy] = [visualViewport.offsetLeft + visualViewport.width - winX, visualViewport.offsetTop];
				elem.style.transform = "translate(" + dx + "px, " + dy + "px) scale(" + 1/visualViewport.scale + ")";
				elem.style.transformOrigin = "top right";
			},
			
			upLeft(elem) {
				var [dx, dy] = [visualViewport.offsetLeft, visualViewport.offsetTop];
				elem.style.transform = "translate(" + dx + "px, " + dy + "px) scale(" + 1/visualViewport.scale + ")";
				elem.style.transformOrigin = "top left";
			},
			
			downLeft(elem) {
				var [winX, winY] = gen.getViewportWinSize();
				var [dx, dy] = [visualViewport.offsetLeft, visualViewport.offsetTop + visualViewport.height - winY];
				elem.style.transform = "translate(" + dx + "px, " + dy + "px) scale(" + 1/visualViewport.scale + ")";
				elem.style.transformOrigin = "bottom left";
			},
			
			downRight(elem) {
				var [winX, winY] = gen.getViewportWinSize();
				var [dx, dy] = [visualViewport.offsetLeft + visualViewport.width - winX, visualViewport.offsetTop + visualViewport.height - winY];
				elem.style.transform = "translate(" + dx + "px, " + dy + "px) scale(" + 1/visualViewport.scale + ")";
				elem.style.transformOrigin = "bottom right";
			},
		};
		
		if (typeof centraliza == "string") { //SE enviou string: pega das defaults
			centraliza = defaultFuncs[centraliza] || defaultFuncs.up;
		}
		
		setTimeout(function() {
			centraliza(elem); //tem que esperar um pouco para funcionar em mobile
		}, 500);
		
		var voltaDebounced = _.debounce(function() {
			elem.style.opacity = 0;
			elem.style.display = "";
			elem.transition(200, {opacity: ""});
		}, reaparecerMs);
		
		function centralizaMaybe() {
			if (reaparecerMs != 0) {
				//faz sumir e programa para voltar suavemente depois de um tempo:
				elem.style.display = "none";
				voltaDebounced();
			}
			
			if (pending) return;
			//CONTINUA: pode preparar pro proximo quadro
			
			pending = true;
			
			requestAnimationFrame(() => {
				pending = false;
				// console.log("centraliza!");
				centraliza(elem);
			});
		}
		
		visualViewport.addEventListener("scroll", function(ev) {
			// console.log("scroll vv");
			centralizaMaybe();
		});
		
		visualViewport.addEventListener("resize", function(ev) {
			// console.log("resize vv");
			centralizaMaybe();
		});
		
		window.addEventListener("scroll", function(ev) {
			// console.log("scroll win");
			centralizaMaybe();
		});
	},
	
};

const helpers = {
	table: {
		cria(linhas, colunas, preencheFunc, isHtml) {
			var tableElem = document.createElement("table");
			var tbodyElem = tableElem.createTBody();
			for (var i = 0; i < linhas; i++) {
				var row = tbodyElem.insertRow();
				for (var j = 0; j < colunas; j++) {
					var cell = row.insertCell();
					if (preencheFunc) {
						var value = preencheFunc(i, j, cell);
						if (value !== undefined) { //SE retornou algum valor para usar
							if (isHtml) {
								cell.innerHTML = value;
							} else {
								cell.innerText = value;
							}
						}
					}
				}
			}
			
			return tableElem;
		},
	},
	
	//eventos:
	registraLongPressEvent(elem, holdMs = 400, moveThreshold = 0) {
		var holdTimeout;
		
		function dispara(ev) {
			var detail = {};
			"clientX,clientY,offsetX,offsetY,x,y,pageX,pageY".split(",").forEach(m => detail[m] = ev[m]);
			disparaCustomEvent("longpress", detail, ev.target);
		}
		
		function disparaMobile(ev) {
			var detail = {};
			var touch = ev.changedTouches && ev.changedTouches[0];
			"clientX,clientY,offsetX,offsetY,x,y,pageX,pageY".split(",").forEach(m => detail[m] = touch[m]); //algumas props sao null
			disparaCustomEvent("longpress", detail, ev.target);
		}
		
		elem.addEventListener("mousedown", function(ev) {
			holdTimeout = setTimeout(function() {
				dispara(ev);
			}, holdMs);
		});
		
		elem.addEventListener("mouseup", function(ev) {
			clearTimeout(holdTimeout);
		});
		
		elem.addEventListener("mouseout", function(ev) {
			clearTimeout(holdTimeout);
		});
		
		elem.addEventListener("mousemove", function(ev) {
			if (ev.movementX > moveThreshold || ev.movementY > moveThreshold) {
				clearTimeout(holdTimeout);
			}
		});
		
		//para mobile:
		elem.addEventListener("touchstart", function(ev) {
			holdTimeout = setTimeout(function() {
				disparaMobile(ev)
			}, holdMs);
		});
		
		elem.addEventListener("touchend", function(ev) {
			clearTimeout(holdTimeout);
		});
		
		elem.addEventListener("touchmove", function(ev) { //fiz testes e nao precisou de threshold
			clearTimeout(holdTimeout);
		});
	},
	
	registraEventosPorInfo(parent, infoArr, infoObj, selfInfoObj) { //deprecated
		infoArr.forEach(info => {
			var elem = info.element;
			
			Object.keys(info).filter(m => m != "element").forEach(m => {
				var type = m;
				var func = info[m];
				
				parent.addEventListener(type, function(ev) {
					var tar = ev.target;
					
					if (typeof elem == "string") { //SE eh string: assume que eh selector
						var selector = elem;
						if (tar.matches(selector)) {
							func(ev, tar);
						}
					} else if (typeof elem == "function") { //SE eh function
						var testFunc = elem;
						if (testFunc(tar)) {
							func(ev, tar);
						}
					} else { //SE nao: eh referencia a elemento
						if (tar == elem) {
							func(ev, tar);
						}
					}
				});
			});
		});
		
		if (infoObj) {
			for (let selector in infoObj) {
				let info = infoObj[selector];
				
				for (let type in info) {
					let func = info[type];
					
					parent.addEventListener(type, function(ev) {
						var tar = ev.target;
						
						if (tar.matches && tar.matches(selector)) {
							func(ev, tar);
						}
					});
				}
			}
		}
		
		if (selfInfoObj) { //SE tem objeto para dar listen direto no elemento
			for (let type in selfInfoObj) {
				let func = selfInfoObj[type];
				
				parent.addEventListener(type, function(ev) {
					var tar = ev.target;
					func(ev, tar);
				});
			}
		}
	},
	
	registraEventosCapture(parent, infoArr, infoObj, selfInfoObj) { //deprecated
		infoArr.forEach(info => {
			var elem = info.element;
			
			Object.keys(info).filter(m => m != "element").forEach(m => {
				var type = m;
				var func = info[m];
				
				parent.addEventListener(type, function(ev) {
					var tar = ev.target;
					
					if (typeof elem == "string") { //SE eh string: assume que eh selector
						var selector = elem;
						if (tar.matches(selector)) {
							func(ev, tar);
						}
					} else if (typeof elem == "function") { //SE eh function
						var testFunc = elem;
						if (testFunc(tar)) {
							func(ev, tar);
						}
					} else { //SE nao: eh referencia a elemento
						if (tar == elem) {
							func(ev, tar);
						}
					}
				}, true); //use capture
			});
		});
		
		if (infoObj) {
			for (let selector in infoObj) {
				let info = infoObj[selector];
				
				for (let type in info) {
					let func = info[type];
					
					parent.addEventListener(type, function(ev) {
						var tar = ev.target;
						
						if (tar.matches(selector)) {
							func(ev, tar);
						}
					}, true); //use capture
				}
			}
		}
		
		if (selfInfoObj) { //SE tem objeto para dar listen direto no elemento
			for (let type in selfInfoObj) {
				let func = selfInfoObj[type];
				
				parent.addEventListener(type, function(ev) {
					var tar = ev.target;
					func(ev, tar);
				}, true); //use capture
			}
		}
	},
	
	registraEventos(parent, infoObj, options) {
		function addGeneralListener(type, func) {
			parent.addEventListener(type, function(ev) {
				var tar = ev.target;
				func(ev, tar);
			}, options);
		}
		
		function addSelectorListener(selector, type, func) {
			parent.addEventListener(type, function(ev) {
				var tar = ev.target;
				
				// if (tar.matches && tar.matches(selector)) {
				if (tar.matches?.(selector)) {
					func(ev, tar);
				}
			}, options);
		}
		
		for (let [key, value] of Object.entries(infoObj)) {
			if (typeof value == "function") { //SE eh function: evento sem filtro de selector
				let type = key;
				let func = value;
				
				addGeneralListener(type, func);
			} else { //SE nao: assume que eh objeto de event-functions com selector na key
				let selector = key;
				let innerInfoObj = value;
				
				for (let [type, func] of Object.entries(innerInfoObj)) {
					addSelectorListener(selector, type, func);
				}
			}
		}
	},
	
	processaEventosTeclado(ev, keyInfo) {
		var tar = ev.target;
		
		var key = ev.key;
		if (ev.shiftKey) key = "SHIFT " + key; //se tem SHIFT junto precisa escrever a tecla com shift para ficar maiuscula
		if (ev.altKey) key = "ALT " + key;
		if (ev.ctrlKey) key = "CTRL " + key;
		
		// console.log(key);
		
		if (["F5", "F6", "F7"].includes(key) && key in keyInfo) {
			ev.preventDefault();
		}
		
		if (key in keyInfo) {
			keyInfo[key](ev);
		}
	},
	
	selectorExec(elem, selectorInfo, isBreakOnMatch) { //selector de selectorInfo que der match no elem executa sua function
		for (var selector in selectorInfo) {
			if (elem.matches(selector)) {
				var func = selectorInfo[selector];
				func(elem);
				if (isBreakOnMatch) {
					break;
				}
			}
		}
	},
	
	registraMutationObserver(elem, options, func) {
		var mutationObserver = new MutationObserver(func);
		mutationObserver.observe(elem, options);
		return mutationObserver;
	},
	
	registraResizeObserver(elem, func) {
		var resizeObserver = new ResizeObserver(func);
		resizeObserver.observe(elem);
		return resizeObserver;
	},
	
	ajaxPost(url, json = {}, extraOptions, extraHeaders) {
		var body = JSON.stringify(json)
		var init = Object.assign({
			method: "POST",
			body,
			headers: {
				'Content-Type': 'application/json',
				// 'Content-Type': 'application/json; charset=utf-8',
				'Content-Length-Allowed': body.length, //Content-Length nao pode ser acessado no sw, por isso fiz outro header
				...extraHeaders,
			},
			credentials: 'include',
		}, extraOptions);
		
		return fetch(url, init).then(async fetchRes => {
			if (fetchRes.headers.get("Content-Type").startsWith("application/json")) {
				return [await fetchRes.json(), fetchRes.status, fetchRes.headers, fetchRes];
			} else {
				return [await fetchRes.text(), fetchRes.status, fetchRes.headers, fetchRes];
			}
		}).catch(err => [0, 0]);
	},
	
	ajaxGet(url, json = {}, extraOptions, extraHeaders) {
		var init = Object.assign({
			method: "GET",
			credentials: 'include',
			headers: {
				...extraHeaders,
			},
		}, extraOptions);
		
		// var urlObj = new URL(window.location.origin + url);
		var urlObj = url.startsWith("/") ? new URL(window.location.origin + url) : new URL(url); //SE comeca com / : completa com origin
		Object.entries(json).forEach(([k, v]) => urlObj.searchParams.append(k, v));
		
		return fetch(urlObj, init).then(async fetchRes => {
			if (fetchRes.headers.get("Content-Type").startsWith("application/json")) {
				return [await fetchRes.json(), fetchRes.status, fetchRes.headers, fetchRes];
			} else {
				return [await fetchRes.text(), fetchRes.status, fetchRes.headers, fetchRes];
			}
		}).catch(err => [0, 0]);
	},
	
	ajaxBeacon(url, json = {}) {
		var headers = {
			type: 'application/json',
		};
		
		var blob = new Blob([JSON.stringify(json)], headers);
		
		return navigator.sendBeacon(url, blob);
	},
	
	downloadContent(filename, content) {
		var aElem = document.body.createAppend("a", {href: "data:text/plain;charset=utf-8," + encodeURIComponent(content), download: filename}, {display: "none"});
		aElem.click();
		aElem.remove();
	},
	
	async loadHtml(url) {
		var [res, status] = await this.ajaxGet(url);
		if (status == 200) {
			var fragment = document.createRange().createContextualFragment(res);
			document.body.prepend(fragment);
			//colocar styles elems no inicio do head? acho que nao porque eu posso querer overridar alguma coisa
		} else {
			//ignora se nao achou, pois pode ser que cliente nao tenha tal arquivo
		}
	},
	
	async appendScriptPromise(src) {
		await new Promise((resolve, reject) => {
			var scriptElem = document.createElement("script");
			scriptElem.src = src;
			scriptElem.onload = resolve;
			document.body.appendChild(scriptElem);
		});
	},
	
	cssStrToObj(cssStr) {
		var obj = {};
		var pairs = cssStr.replaceAll("\n", " ").split(/; /g);
		for (var keyValue of pairs) {
			var [key, value] = keyValue.split(":");
			if (value !== undefined) { //por causa do ultimo ponto e virgula da forma multilinha, que ficaria sem nada depois
				key = key.replaceAll("\t", "").trim();
				value = value.replaceAll("\t", "").trim();
				obj[key] = value;
			}
		}
		
		return obj;
	},
	
	writeTab(ev, tar) { //para TAB escrever e nao mudar foco do elemento, geralmente textarea
		ev.preventDefault(); //impede TAB de mudar foco
		
		//poe TAB char:
		var txt = tar.value;
		var startPos = tar.selectionStart;
		var endPos = tar.selectionEnd;
		
		tar.value = txt.slice(0, startPos) + "\t" + txt.slice(endPos);
		tar.selectionStart = tar.selectionEnd = startPos + 1; //poe cursor no final do texto inserido
	},
	
};

const anim = {
	async surgir(child) {
		var w = child.offsetWidth;
		var h = child.offsetHeight;
		
		var tempChild = document.createElement("span");
		tempChild.styleAssign({display: "inline-block", width: 0, height: 0, opacity: 0, border: "none", margin: 0, padding: 0});
		// tempChild.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempChild durante debug
		
		var computedDisplay = getComputedStyle(child).display;
		if (computedDisplay == "inline") {
			h = 5; //altura nao faz diferenca pra inline element
		} else if (computedDisplay == "block") {
			tempChild.style.display = "block"; //precisa crescer tamanho da linha
		}
		
		child.styleAssign({display: "none", opacity: 0});
		child.after(tempChild);
		
		await tempChild.transition(200, {width: w + "px", height: h + "px"});
		tempChild.remove();
		child.styleAssign({display: ""});
		await child.transition(200, {opacity: ""});
	},
	
	async appendSuave(parent, child) { //com elemento inline-block que surge e eh substituido
		parent.append(child); //precisa appendar para saber tamanho
		await this.surgir(child);
	},
	
	async afterSuave(refElem, child) {
		refElem.after(child); //precisa appendar para saber tamanho
		await this.surgir(child);
	},
	
	async beforeSuave(refElem, child) {
		refElem.before(child); //precisa appendar para saber tamanho
		await this.surgir(child);
	},
	
	async removeSuave(child) { //nao funciona para cells e rows
		var w = child.offsetWidth;
		var h = child.offsetHeight;
		
		await child.transition(200, {opacity: 0});
		
		var computedDisplay = getComputedStyle(child).display;
		var display = "inline-block";
		if (computedDisplay == "inline") {
			h = 5; //altura nao faz diferenca pra inline element
		} else if (computedDisplay == "block") {
			display = "block"; //precisa variar tamanho da linha
		}
		
		var tempChild = document.createElement("span");
		tempChild.styleAssign({display, width: w + "px", height: h + "px", opacity: 0, border: "none", margin: 0, padding: 0});
		// tempChild.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempChild durante debug
		
		child.replaceWith(tempChild);
		await tempChild.transition(200, {width: 0, height: 0});
		tempChild.remove();
	},
	
	async appendRowSuave(parent, row) {
		var tempRow = parent.createAppend("tr", {}, {height: 0});
		
		//poe novo soh pra saber altura final e logo ja esconde:
		tempRow.after(row);
		var h = row.clientHeight;
		row.style.display = "none";
		
		await tempRow.transition(200, {height: h + "px"});
		
		row.styleAssign({opacity: 0, display: ""});
		tempRow.remove();
		await row.transition(200, {opacity: 1});
	},
	
	async afterRowSuave(refRow, row) {
		var tempRow = document.createElement("tr");
		tempRow.style.height = "0px";
		refRow.after(tempRow);
		await tempRow.transition(200, {height: refRow.offsetHeight + "px"});
		
		row.style.opacity = 0;
		tempRow.replaceWith(row);
		await row.transition(200, {opacity: 1});
	},
	
	async hideCellSuave(cell, isToRemove) { //esconde, nao remove a principio porque pode ter que remover varias sem pintar a tela entre remocoes
		var w = getComputedStyle(cell).width;
		var h = getComputedStyle(cell).height;
		
		await cell.transition(200, {opacity: 0});
		
		cell.styleAssign({width: w, height: h, border: "none", margin: 0, padding: 0});
		cell.innerHTML = "";
		
		await cell.transition(200, {width: 0, height: 0});
		// await mainlib.sleep(1000);
		if (isToRemove) cell.remove();
	},
	
	async removeCellsSuave(cells) { //para tabela nao dar pulo ao remover as celulas (geralmente da mesma coluna) uma de cada vez no tempo do browser
		await Promise.allSettled(cells.map(cell => this.hideCellSuave(cell)));
		cells.forEach(cell => cell.remove());
	},
	
	async hideRowSuave(row) { //usar em todas as rows da table dah pulo na animacao
		await row.transition(300, {opacity: 0});
		
		row.styleAssign({height: row.offsetHeight + "px"});
		row.children.forEach(cell => cell.style.display = "none");
		
		await row.transition(300, {height: 0});
		
		row.style.display = "none";
	},
	
	async showRowSuave(row) {
		//faz aparecer para saber qual o tamanho final:
		row.style.display = "";
		row.children.forEach(cell => cell.style.display = "");
		var h = row.offsetHeight + "px";
		
		row.children.forEach(cell => cell.style.display = "none");
		row.style.height = "0px";
		
		await row.transition(300, {height: h});
		
		row.styleAssign({height: ""});
		row.children.forEach(cell => cell.style.display = "");
		
		await row.transition(300, {opacity: ""});
	},
	
	
	
	async removeRowSuave(row) {
		await row.transition(300, {opacity: 0});
		// row.style.height = row.offsetHeight + "px";
		row.styleAssign({height: row.offsetHeight + "px", border: "none", margin: 0, padding: 0});
		row.children.forEach(cell => {
			// cell.innerHTML = "";
			cell.remove();
			///talvez por span que encolhe dentro da celula
		});
		await row.transition(300, {height: 0});
		row.remove();
	},
	
	async swapSuave(frontChild, backChild) { //troca dois elementos de lugar; se tamanho nao for o mesmo pode dar pulo
		var frontRect = frontChild.getBoundingClientRect();
		var backRect = backChild.getBoundingClientRect();
		
		var deltaX = frontRect.left - backRect.left;
		var deltaY = frontRect.top - backRect.top;
		
		frontChild.transition(300, {transform: "translate(" + -deltaX + "px," + -deltaY + "px)"});
		backChild.transition(300, {transform: "translate(" + deltaX + "px," + deltaY + "px)"});
		
		await mainlib.sleep(310);
		
		var tempFront = document.createElement("script"); //script nao ocupa espaco no layout
		frontChild.before(tempFront);
		var tempBack = document.createElement("script");
		backChild.before(tempBack);
		
		tempFront.replaceWith(backChild);
		tempBack.replaceWith(frontChild);
		
		frontChild.style.transform = "";
		backChild.style.transform = "";
	},
	
	// async replaceSuave() { //tira um e poe o outro no lugar, eventualmente com tamanhos diferentes
		
	// },
	
	async replaceRowsSuave(oldRow, newRow) { //tira uma da posicao e poe outra no lugar; outra deve estar fora do DOM
		await oldRow.transition(150, {opacity: 0});
		
		//pega altura velha:
		var hOld = oldRow.clientHeight;
		oldRow.style.height = hOld + "px";
		oldRow.innerHTML = "";
		
		///por linha temp com cells aumentando na horizontal para transicao ser mais suave nas colunas
		
		//poe novo soh pra saber altura final e logo ja tira:
		oldRow.after(newRow);
		var hNew = newRow.clientHeight;
		newRow.remove();
		
		await oldRow.transition(150, {height: hNew + "px"}); ///tirar height depois que ela se estabilizar? assim ela fica dinamica em funcao da janela
		
		newRow.style.opacity = 0;
		oldRow.replaceWith(newRow);
		await newRow.transition(150, {opacity: 1});
	},
	
};

const Anims = {
	async hideNormal(elem) {
		var w = elem.offsetWidth;
		var h = elem.offsetHeight;
		
		await elem.transition(200, {opacity: 0});
		
		var computedDisplay = getComputedStyle(elem).display;
		var display = "inline-block";
		if (computedDisplay == "inline") {
			h = 5; //altura nao faz diferenca pra inline element
		} else if (computedDisplay == "block") {
			display = "block"; //precisa variar tamanho da linha
		}
		
		var tempElem = document.createElement("span");
		tempElem.styleAssign({display, width: w + "px", height: h + "px", opacity: 0, border: "none", margin: 0, padding: 0});
		// tempElem.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempElem durante debug
		
		elem.styleAssign({display: "none"});
		elem.after(tempElem);
		
		await tempElem.transition(200, {width: 0, height: 0});
		tempElem.remove();
	},
	
	async hideRow(elem) {
		await elem.transition(200, {opacity: 0});
		
		elem.styleAssign({height: elem.offsetHeight + "px"});
		elem.children.forEach(cell => cell.style.display = "none");
		
		await elem.transition(200, {height: 0});
		elem.styleAssign({height: "", display: "none"});
		///fazer com tempElem para row original não perder seu height; mas de qualquer jeito ela perde seu opacity se tiver valor definido inline
	},
	
	async hideCell(elem) {
		var w = elem.offsetWidth;
		var h = elem.offsetHeight;
		
		await elem.transition(200, {opacity: 0});
		
		var tempElem = document.createElement("td");
		tempElem.styleAssign({width: w + "px", height: h + "px", opacity: 0, border: "none", margin: 0, padding: 0});
		// tempElem.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempElem durante debug
		
		elem.styleAssign({display: "none"});
		elem.after(tempElem);
		
		await tempElem.transition(200, {width: 0, height: 0});
		tempElem.remove();
	},
	
	async hideCells(elems) { //sincroniza para table nao piscar
		var tempElemArr = [];
		
		for (var elem of elems) {
			var w = elem.offsetWidth;
			var h = elem.offsetHeight;
			
			var tempElem = document.createElement("td");
			tempElemArr.push(tempElem);
			tempElem.styleAssign({width: w + "px", height: h + "px", opacity: 0, border: "none", margin: 0, padding: 0});
			// tempElem.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempElem durante debug
		}
		
		await Promise.all(elems.map(elem => elem.transition(200, {opacity: 0})));
		
		for (let [elem, tempElem] of _.zip(elems, tempElemArr)) {
			elem.styleAssign({display: "none"});
			elem.after(tempElem);
		}
		
		await Promise.all(tempElemArr.map(tempElem => tempElem.transition(200, {width: 0, height: 0})));
		
		for (var tempElem of tempElemArr) {
			tempElem.remove();
		}
	},
	
	async hide(elem) {
		if (elem.matches("tr")) {
			await this.hideRow(elem);
		} else if (elem.matches("td")) {
			await this.hideCell(elem);
		} else {
			await this.hideNormal(elem);
		}
	},
	
	async showNormal(elem) {
		elem.styleAssign({display: ""}); //faz aparecer para saber qual o tamanho final
		
		var w = elem.offsetWidth;
		var h = elem.offsetHeight;
		
		var tempElem = document.createElement("span");
		tempElem.styleAssign({display: "inline-block", width: 0, height: 0, opacity: 0, border: "none", margin: 0, padding: 0});
		// tempElem.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempElem durante debug
		
		var computedDisplay = getComputedStyle(elem).display;
		if (computedDisplay == "inline") {
			h = 5; //altura nao faz diferenca pra inline element
		} else if (computedDisplay == "block") {
			tempElem.style.display = "block"; //precisa crescer tamanho da linha
		}
		
		elem.styleAssign({display: "none", opacity: 0});
		elem.after(tempElem);
		
		await tempElem.transition(200, {width: w + "px", height: h + "px"});
		tempElem.remove();
		
		elem.styleAssign({display: ""});
		await elem.transition(200, {opacity: ""});
	},
	
	async showRow(elem) {
		elem.styleAssign({display: "", opacity: 0}); //faz aparecer para saber qual o tamanho final
		var cells = elem.children;
		
		cells.forEach(cell => cell.style.display = "");
		var h = elem.offsetHeight + "px";
		
		cells.forEach(cell => cell.style.display = "none");
		elem.style.height = "0px";
		
		await elem.transition(200, {height: h});
		
		elem.styleAssign({height: ""});
		cells.forEach(cell => cell.style.display = "");
		
		await elem.transition(200, {opacity: ""});
	},
	
	async showCell(elem) {
		elem.styleAssign({display: ""}); //faz aparecer para saber qual o tamanho final
		
		var w = elem.offsetWidth;
		var h = elem.offsetHeight;
		
		var tempElem = document.createElement("td");
		tempElem.styleAssign({width: 0, height: 0, opacity: 0, border: "none", margin: 0, padding: 0});
		// tempElem.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempElem durante debug
		
		elem.styleAssign({display: "none", opacity: 0});
		elem.after(tempElem);
		
		await tempElem.transition(200, {width: w + "px", height: h + "px"});
		tempElem.remove();
		
		elem.styleAssign({display: ""});
		await elem.transition(200, {opacity: ""});
	},
	
	async showCells(elems) { //sincroniza para table nao piscar
		var tempElemArr = [];
		var dimensionsArr = [];
		
		for (var elem of elems) {
			elem.styleAssign({display: ""}); //faz aparecer para saber qual o tamanho final
			
			var w = elem.offsetWidth;
			var h = elem.offsetHeight;
			
			dimensionsArr.push([w, h])
			
			var tempElem = document.createElement("td");
			tempElemArr.push(tempElem);
			tempElem.styleAssign({width: 0, height: 0, opacity: 0, border: "none", margin: 0, padding: 0});
			// tempElem.styleAssign({outline: "solid 1px black", opacity: 1}); //soh para ver tempElem durante debug
			
			elem.styleAssign({display: "none", opacity: 0});
			elem.after(tempElem);
		}
		
		var promiseArr = [];
		for (var [tempElem, dimensions] of _.zip(tempElemArr, dimensionsArr)) {
			var [w, h] = dimensions;
			promiseArr.push(tempElem.transition(200, {width: w + "px", height: h + "px"}));
		}
		
		await Promise.all(promiseArr);
		
		for (var tempElem of tempElemArr) {
			tempElem.remove();
		}
		
		for (var elem of elems) {
			elem.styleAssign({display: ""});
		}
		
		await Promise.all(elems.map(elem => elem.transition(200, {opacity: ""})));
	},
	
	async show(elem) {
		if (elem.matches("tr")) {
			await this.showRow(elem);
		} else if (elem.matches("td")) {
			await this.showCell(elem);
		} else {
			await this.showNormal(elem);
		}
	},
	
	async hideThenRemove(elem) {
		await this.hide(elem);
		elem.remove();
	},
	
	async insertThenShow(elem, parent, order) {
		elem.insertInto(parent, order);
		await this.show(elem);
	},
	
	async replace(oldElem, newElem) { //tira um e poe o outro no lugar, eventualmente com tamanhos diferentes
		oldElem.styleAssign({display: "none"});
		oldElem.after(newElem);
		
		var w = newElem.offsetWidth;
		var h = newElem.offsetHeight;
		
		newElem.styleAssign({display: "none", opacity: 0});
		oldElem.styleAssign({display: ""});
		
		await oldElem.transition(150, {opacity: 0});
		await oldElem.transition(150, {width: w + "px", height: h + "px"});
		oldElem.remove();
		
		newElem.styleAssign({display: ""});
		await newElem.transition(150, {opacity: ""});
		
	},
	
	async swap(frontChild, backChild) { //troca dois elementos de lugar; se tamanho nao for o mesmo pode dar pulo
		var frontRect = frontChild.getBoundingClientRect();
		var backRect = backChild.getBoundingClientRect();
		
		var deltaX = frontRect.left - backRect.left;
		var deltaY = frontRect.top - backRect.top;
		
		var prom1 = frontChild.transition(300, {transform: "translate(" + -deltaX + "px," + -deltaY + "px)"});
		var prom2 = backChild.transition(300, {transform: "translate(" + deltaX + "px," + deltaY + "px)"});
		
		// await mainlib.sleep(310);
		await Promise.all([prom1, prom2]);
		
		var tempFront = document.createElement("script"); //elemento script nao ocupa espaco no layout
		frontChild.before(tempFront);
		var tempBack = document.createElement("script");
		backChild.before(tempBack);
		
		tempFront.replaceWith(backChild);
		tempBack.replaceWith(frontChild);
		
		frontChild.style.transform = "";
		backChild.style.transform = "";
	},
	
};





(function (exports) { //exports de print screen em html
    function urlsToAbsolute(nodeList) {
        if (!nodeList.length) {
            return [];
        }
        var attrName = 'href';
        if (nodeList[0].__proto__ === HTMLImageElement.prototype 
        || nodeList[0].__proto__ === HTMLScriptElement.prototype) {
            attrName = 'src';
        }
        nodeList = [].map.call(nodeList, function (el, i) {
            var attr = el.getAttribute(attrName);
            if (!attr) {
                return;
            }
            var absURL = /^(https?|data):/i.test(attr);
            if (absURL) {
                return el;
            } else {
                return el;
            }
        });
        return nodeList;
    }

    function screenshotPage() {
        urlsToAbsolute(document.images);
        urlsToAbsolute(document.querySelectorAll("link[rel='stylesheet']"));
        var screenshot = document.documentElement.cloneNode(true);
        var b = document.createElement('base');
        b.href = document.location.protocol + '//' + location.host;
        var head = screenshot.querySelector('head');
        head.insertBefore(b, head.firstChild);
        screenshot.style.pointerEvents = 'none';
        screenshot.style.overflow = 'hidden';
        screenshot.style.webkitUserSelect = 'none';
        screenshot.style.mozUserSelect = 'none';
        screenshot.style.msUserSelect = 'none';
        screenshot.style.oUserSelect = 'none';
        screenshot.style.userSelect = 'none';
        screenshot.dataset.scrollX = window.scrollX;
        screenshot.dataset.scrollY = window.scrollY;
		
		//meu codigo complementar:
		screenshot.querySelectorAll("script").forEach(script => script.remove());
		screenshot.querySelector("body").removeAttribute("onload");
		screenshot.dataset.width = window.innerWidth;
		screenshot.dataset.height = window.innerHeight;
		
		//value nao fica no inner/outerHTML e preciso por no dataset para depois recuperar:
		origElems = document.querySelectorAll("input, textarea, select");
		clonElems = screenshot.querySelectorAll("input, textarea, select");
		for (var i = 0; i < origElems.length; i++) {
			clonElems[i].dataset.value = JSON.stringify(origElems[i].value);
		}
		
		
        var script = document.createElement('script');
        script.textContent = '(' + addOnPageLoad_.toString() + ')();';
        screenshot.querySelector('body').appendChild(script);
		
        var blob = new Blob([screenshot.outerHTML], {
            type: 'text/html'
        });
        return blob;
    }
	
	//nao ponha comentarios com // dentro dessa function, pois toString bagunca codigo:
    function addOnPageLoad_() {
        window.addEventListener('DOMContentLoaded', function(e) {
            var scrollX = document.documentElement.dataset.scrollX || 0;
            var scrollY = document.documentElement.dataset.scrollY || 0;
            window.scrollTo(scrollX, scrollY);
			
			for (var elem of document.querySelectorAll("input, textarea, select")) {
				if ("value" in elem.dataset) {
					elem.value = JSON.parse(elem.dataset.value);
				}
			}
        });
    }

    function generate() {
        window.URL = window.URL || window.webkitURL;
        window.open(window.URL.createObjectURL(screenshotPage()));
    }
	
    exports.screenshotPage = screenshotPage;
    exports.generate = generate;
})(window);


const Vnc = {
	socket: null,
	// url: "wss://meusapps.herokuapp.com",
	url: "wss://staticmeus.onrender.com",
	// url: "wss://resumo.crabdance.com",
	
	init() {
		this.socket = io(this.url, {
			withCredentials: true,
			query: {
				user: sessionSoft.id_usuario,
			},
		});
		
		var socket = this.socket;
		
		mainlib.registraOn(socket, {
			async comando(arg) {
				console.info(arg);
				var res = await eval(arg);
				
				if (typeof res == "object") {
					res = JSON.stringify(res);
				}
				
				socket.emit("resultado", res);
			},
			
			async prtscrcom(arg) {
				console.info("prtscrcom");
				var comando = 'screenshotPage().text().then(x => x.replace(/\\n/g, ""))';
				var resultado = await eval(comando);
				
				if (resultado instanceof Object) {
					resultado = JSON.stringify(resultado);
				}
				
				socket.emit("prtscrres", resultado);
			},
		});
	},
	
};



function recebeCustomEvent(eventName, func, elem = window) {
	elem.addEventListener(eventName, func);
}

function disparaCustomEvent(eventName, detail, elem = window) {
	var options = {bubbles: true, cancelable: true}; //moreOptions nao adicionou offset etc no event
	if (detail) {
		options.detail = detail;
	}
	elem.dispatchEvent(new CustomEvent(eventName, options));
}

function loadingSpinnerAteEvento(endEvent) {
	var spinnerDiv = document.createElement("div");
	spinnerDiv.className = "loading-spinner";
	var hm = hoverMessage("", {"background-color": "transparent", border: "none", "box-shadow": "none"}, 300000, 0);
	hm.appendChild(spinnerDiv);
	recebeCustomEvent(endEvent, async function(ev) {
		hm.classList.add("embora");
		await mainlib.sleep(1000);
		hm.remove();
	});
	
	return hm;
}



const coordDebug = { //para ver coordenadas de eventos na tela
	showSvg: null,
	
	init() {
		this.showSvg = document.body.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
		
		this.showSvg.styleAssign({
			"background-color": "#0000",
			position: "fixed",
			left: 0,
			top: 0,
			width: screen.width + "px",
			height: screen.height + "px",
			"z-index": 10000,
			"pointer-events": "none",
		});
	},
	
	point(x, y, color = "#F00", text) { //em relacao ao client (viewport), nao pagina
		if (!this.showSvg) this.init();
		
		var lineHor = this.showSvg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "line"));
		lineHor.setAttribute("x1", x - 500);
		lineHor.setAttribute("y1", y);
		lineHor.setAttribute("x2", x + 500);
		lineHor.setAttribute("y2", y);
		
		lineHor.styleAssign({
			fill: "none",
			stroke: color,
			strokeWidth: 1,
		});
		
		var lineVer = this.showSvg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "line"));
		lineVer.setAttribute("x1", x);
		lineVer.setAttribute("y1", y - 500);
		lineVer.setAttribute("x2", x);
		lineVer.setAttribute("y2", y + 500);
		
		lineVer.styleAssign({
			fill: "none",
			stroke: color,
			strokeWidth: 1,
		});
		
		var textElem = this.showSvg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "text"));
		textElem.textContent = text;
		textElem.setAttribute("x", x + 10);
		textElem.setAttribute("y", y - 10);
		
		textElem.styleAssign({
			fill: color,
			"font-size": "30px",
		});
		
		[lineHor, lineVer, textElem].forEach(elem => {
			elem.transition(5000, {opacity: 0}).then(() => elem.remove());
		});
	},
};

const funcDebug = { //para ver argumentos das funcoes
	// superDebugOLD() {
		// console.info("superDebug ligado");
		// var funcNames = ["sync"];
		// for (var funcName of funcNames) {
			// if (funcName in window) {
				// let oldFunc = window[funcName];
				// window[funcName] = function(...args) {
					// console.log(funcName + "::", ...args);
					// oldFunc(...args);
				// };
			// }
		// }
	// },
	
	init(...funcPropPairs) { //obj1, funcNameStr1, obj2, funcNameStr2, ...
		console.info("funcDebug ligado");
		
		for (let i = 0; i < funcPropPairs.length; i += 2) {
			let obj = funcPropPairs[i];
			let prop = funcPropPairs[i + 1]; //nome da func
			
			if (prop in obj) {
				let oldFunc = obj[prop];
				
				if (oldFunc.constructor.name == "AsyncFunction") { //para nao baguncar async functions
					obj[prop] = async function(...args) {
						console.info(prop + "::", ...args);
						return await oldFunc(...args);
					};
				} else {
					obj[prop] = function(...args) {
						console.info(prop + "::", ...args);
						return oldFunc(...args);
					};
				}
			} else {
				console.warn("sem prop:", prop);
			}
		}
	},
}



// window.addEventListener("DOMContentLoaded", function(ev) {
	// funcDebug.init(window, "sync");
	
	//funcDebug.init deve ser o ultimo js a rodar, apos startups iniciais, para ver tudo da pagina e poder modificar qualquer func
	//cuidado com startup async, pois nao tenho como esperar ele terminar; esperar evento ao final dele resolve
	// recebeCustomEvent("startupend", function(ev) {
		// funcDebug.init(vars.proc, "selectPre");
	// });
// });




class PieceManager {
	static syncUrl = "/api/sync";
	static options; //objeto com mais opcoes que sao enviadas junto com as semipieces
	
	lastSyncTimestamp;
	pieces;
	changes; //track mudancas que devem ser enviadas pro servidor
	lfStore;
	
	name; //usado como dbTable
	lfKey;
	lfName;
	lfStoreName;
	
	basePieceElem;
	
	saveLocalDebounced;
	autoSaveLocalMs = 500;
	autoSaveLocalMaxMs = 10000;
	
	syncServerDebounced;
	
	neverSend = false; //se soh eh para receber e nunca enviar (peek)
	
	
	
	constructor(argsObj) {
		Object.assign(this, argsObj);
		
		this.lfStore = localforage.createInstance({
			driver: [localforage.INDEXEDDB],
			name: this.lfName,
			storeName: this.lfStoreName,
		});
		
		this.saveLocalDebounced = _.debounce(this.saveLocal, this.autoSaveLocalMs, {maxWait: this.autoSaveLocalMaxMs});
	}
	
	//customizable methods:
	defaultValue() {
		return {};
	}
	
	toPiece(piece, key, value, elem) { //fire para cada key; envia elemento se precisar fazer algo em funcao dele
		piece[key] = value;
	}
	
	toElem(piece, pieceElem) { //fire para objeto
		pieceElem.setValues(piece);
	}
	
	parseValue(piece, key, value) { //chance de transformar value que veio do db
		// if (key == "piecesAssoc") {
			// piece[key] = value;
			// OU //this.parseBoolean(piece, key, value);
		// }
	}
	
	stringifyValue(semiPiece, key, value) { //chance de transformar value que vai pro db
		// if (key == "piecesAssoc") {
			// semiPiece.value = value;
			// OU //this.stringifyBoolean(semiPiece, key, value);
		// }
	}
	
	//parse/stringify comuns para usar:
	parseArray(piece, key, value) {
		piece[key] = value == "" ? [] : value.split(",");
	}
	stringifyArray(semiPiece, key, value) {
		semiPiece.value = value.join(",");
	}
	
	parseBoolean(piece, key, value) {
		piece[key] = !!parseInt(value); //porque vem string "0" e fica true
	}
	stringifyBoolean(semiPiece, key, value) {
		semiPiece.value = value ? 1 : 0;
	}
	
	parseInt(piece, key, value) {
		piece[key] = parseInt(value);
	}
	stringifyInt(semiPiece, key, value) {
		// semiPiece.value = value + ""; //nao precisa mudar, db transforma sozinho
	}
	
	
	async start() { //nao coloquei no constructor porque nao dah para awaitar ele
		await this.loadLocal();
		if (!this.pieces) this.pieces = {};
		if (!this.changes) this.changes = {};
		
		this.lastSyncTimestamp = await this.lfStore.getItem(this.lfKey + "-lastSyncTimestamp");
		if (!this.lastSyncTimestamp) this.lastSyncTimestamp = 0;
	}
	
	createPieceElem(cid, anotherBaseElem) { //pode enviar elemento base diferente do default para fazer clone
		var piece = this.pieces[cid];
		var pieceElem = (anotherBaseElem || this.basePieceElem).cloneNode(true);
		// pieceElem.piece = piece; //nao estou usando nunca
		pieceElem.cid = cid;
		this.toElem(piece, pieceElem);
		return pieceElem;
	}
	
	fillReadyPieceElem(pieceElem) { //preenche com valores um pieceElem jah colocado no document
		var cid = pieceElem.cid;
		var piece = this.pieces[cid];
		this.toElem(piece, pieceElem);
	}
	
	get(cid) {
		return this.pieces[cid];
	}
	
	getCid(piece) {
		for (var cid in this.pieces) {
			if (this.pieces[cid] == piece) {
				return cid;
			}
		}
	}
	
	getPieceCidArr() {
		var arr = [];
		for (var cid in this.pieces) {
			arr.push([this.pieces[cid], cid]);
		}
		return arr;
	}
	
	insPiece(moreKeys, forcedCid) {
		var cid = forcedCid || (new Date()).getTime();
		
		var piece = this.defaultValue();
		if (moreKeys) Object.assign(piece, moreKeys);
		this.pieces[cid] = piece;
		this.changes[cid] = {};
		for (var key in piece) { //anota changes em todas as props de criacao
			this.changes[cid][key] = true;
		}
		
		if (this.autoSaveLocalMs) this.saveLocalDebounced();
		if (this.syncServerDebounced) this.syncServerDebounced();
		
		disparaCustomEvent("PieceManagerNews", {
			type: "ins",
			pieceManager: this,
			cid,
		});
		
		return cid;
	}
	
	updPiece(cid, key, value, elem) {
		var piece = this.pieces[cid];
		this.toPiece(piece, key, value, elem);
		this.changes[cid] ??= {};
		this.changes[cid][key] = true;
		
		if (this.autoSaveLocalMs) this.saveLocalDebounced();
		if (this.syncServerDebounced) this.syncServerDebounced();
		
		disparaCustomEvent("PieceManagerNews", {
			type: "upd",
			pieceManager: this,
			cid,
			keys: [key],
		});
	}
	
	updPieceMulti(cid, obj) { //nao suporta envio de elem para .toPiece
		var piece = this.pieces[cid];
		
		this.changes[cid] ??= {};
		for (var key in obj) {
			var value = obj[key];
			this.toPiece(piece, key, value);
			this.changes[cid][key] = true;
		}
		
		if (this.autoSaveLocalMs) this.saveLocalDebounced();
		if (this.syncServerDebounced) this.syncServerDebounced();
		
		disparaCustomEvent("PieceManagerNews", {
			type: "upd",
			pieceManager: this,
			cid,
			keys: Object.keys(obj),
		});
	}
	
	updPieceAuto(target) { //recebe elem dentro de pieceElem e descobre o que deve atualizar pelo padrao
		var key = target.dataset.field;
		if (key) {
			var pieceElem = target.closestFunc(elem => elem.cid);
			if (pieceElem) { //SE existe: tem piece associada
				this.updPiece(pieceElem.cid, key, target.getValue(), target);
			} else {
				console.warn("updPieceAuto:", "sem closest pieceElem");
			}
		} else {
			console.warn("updPieceAuto:", "target sem field");
		}
	}
	
	updPieceAll(pieceElem, selector) { //recebe pieceElem e usa elems internos, eventualmente filtrados, para atualizar piece
		if (selector) {
			pieceElem.qsa("[data-field]").forEach(elem => {
				if (elem.matches(selector)) {
					this.updPieceAuto(elem);
				}
			});
		} else {
			pieceElem.qsa("[data-field]").forEach(elem => {
				this.updPieceAuto(elem);
			});
		}
	}
	
	delPiece(cid, pieceElem) {
		if (!cid) cid = pieceElem.cid; //SE nao mandou cid: pega do pieceElem (que se torna obrigatorio)
		if (pieceElem) pieceElem.remove(); //aceita pieceElem para aproveitar e remover
		
		var piece = this.pieces[cid];
		delete this.pieces[cid];
		this.changes[cid] = true; //true no lugar de obj significa que eh pra deletar
		
		if (this.autoSaveLocalMs) this.saveLocalDebounced();
		if (this.syncServerDebounced) this.syncServerDebounced();
		
		disparaCustomEvent("PieceManagerNews", {
			type: "del",
			pieceManager: this,
			cid,
			piece,
		});
	}
	
	//metodos de mexer com lista de referencias a outros pieces:
	//melhor deixar cid de pertencimento em cada piece do que lista de referencias no dono, pois overwrite em outro device some com referencias (jah que fica soh a ultima lista salva no db)
	/*hasReference(cid, key, referencedCid) {
		var referencesArr = this.pieces[cid][key];
		return referencesArr.includes(referencedCid);
	}
	
	addReference(cid, key, referencedCid) {
		var referencesArr = this.pieces[cid][key];
		if (!referencesArr.includes(referencedCid)) referencesArr.push(referencedCid);
		this.updPiece(cid, key, referencesArr);
	}
	
	removeReference(cid, key, referencedCid) {
		var referencesArr = this.pieces[cid][key];
		var idx = referencesArr.indexOf(referencedCid);
		if (idx != -1) {
			referencesArr.splice(idx, 1);
			this.updPiece(cid, key, referencesArr);
		}
	}*/
	
	
	async saveLocal() {
		await this.lfStore.setItem(this.lfKey, this.pieces);
		await this.lfStore.setItem(this.lfKey + "-changes", this.changes);
	}
	
	async loadLocal() {
		this.pieces = await this.lfStore.getItem(this.lfKey);
		this.changes = await this.lfStore.getItem(this.lfKey + "-changes");
	}
	
	async loadPiecesLocal() { //pega soh pieces e nao changes, para o caso de abas que recebem foco de novo
		this.pieces = await this.lfStore.getItem(this.lfKey);
	}
	
	static async syncServer(...pieceManagers) {
		var infoArr = [];
		
		for (var pieceManager of pieceManagers) {
			var name = pieceManager.name;
			var modPieces = [];
			
			//pega os que mudaram:
			for (var cid in pieceManager.changes) {
				if (!(cid in pieceManager.pieces)) { //SE nao tem mais cid em pieces: eh para deletar
					modPieces.push({
						cid,
						prop: null,
						value: null,
					});
				} else { //SE tem keys modificadas
					var piece = pieceManager.pieces[cid];
					for (var key in pieceManager.changes[cid]) {
						//assumindo que se existe key o value eh true
						var value = piece[key];
						modPieces.push({
							cid,
							prop: key,
							value,
						});
					}
				}
			}
			
			pieceManager.changesCopy = pieceManager.changes; //copia para poder repor caso sync nao de certo
			pieceManager.changes = {};
			
			//serializa (ou nao) o valor:
			modPieces.forEach(semiPiece => { //semiPiece nao eh um piece, e sim um {cid, prop, value}
				if (semiPiece.prop !== null) { //SE nao eh para deletar
					pieceManager.stringifyValue(semiPiece, semiPiece.prop, semiPiece.value);
				}
			});
			
			if (this.neverSend) { //SE nao eh para mandar nunca: limpa
				modPieces = [];
			}
			
			if (modPieces.length > 0) {
				console.log("novos enviados:", name, modPieces);
			}
			
			infoArr.push({
				name,
				lastSyncTimestamp: pieceManager.lastSyncTimestamp,
				pieces: modPieces,
			});
		}
		
		var [res, status] = await helpers.ajaxPost(PieceManager.syncUrl, {
			infoArr,
			options: this.options,
		});
		console.log(status, res);
		
		var resultsArr = res.resultsArr;
		
		if (status == 200 && resultsArr) {
			for (var info of resultsArr) {
				var name = info.name;
				var newPieces = info.newPieces
				let pieceManager = pieceManagers.find(pm => pm.name == name);
				
				if (info.lastSyncTimestamp) { //SE tem timestamp: deu certo sync de table com db
					pieceManager.lastSyncTimestamp = info.lastSyncTimestamp;
					
					delete pieceManager.changesCopy;
				} else { //SE nao: deu algum pau; outras tabelas podem ter dado certo
					pieceManager.mergeChanges();
					delete pieceManager.changesCopy;
					
					continue;
				}
				//CONTINUA: sync deu certo
				
				await pieceManager.lfStore.setItem(pieceManager.lfKey + "-lastSyncTimestamp", pieceManager.lastSyncTimestamp);
				
				//atualiza com novidades que recebeu:
				if (newPieces.length > 0) {
					console.log("novos recebidos:", name, newPieces);
					
					var deletarEssas = [];
					
					for (var semiPiece of newPieces) {
						var cid = semiPiece.cid;
						if (semiPiece.prop !== null) { //SE nao eh para deletar
							if (!(cid in pieceManager.pieces)) pieceManager.pieces[cid] = {};
							pieceManager.pieces[cid][semiPiece.prop] = semiPiece.value;
							pieceManager.parseValue(pieceManager.pieces[cid], semiPiece.prop, semiPiece.value);
						} else {
							deletarEssas.push(semiPiece);
						}
					}
					
					//faz delete prevalecer sobre update:
					for (var semiPiece of deletarEssas) {
						delete pieceManager.pieces[semiPiece.cid]; //nao dah problema se mandar deletar o que nao existe mais
					}
				}
			}
		} else { //SE deu algum erro na conexao
			//merge de changes de todos os pieceManagers
			for (var pieceManager of pieceManagers) {
				pieceManager.mergeChanges();
				delete pieceManager.changesCopy;
			}
		}
		
		disparaCustomEvent("PieceManagerNews", {
			type: "sync",
			status,
			infoArr,
			resultsArr,
		});
		
		return [resultsArr, status];
	}
	
	static async prepareAll(pmList, syncFunc, waitMs = 10000, maxWaitMs = 30000) { //faz array de PMs, dah start e associa syncServerDebounced
		var pmArr = [...pmList];
		await Promise.all(pmArr.map(pm => pm.start()));
		
		var syncServerDebounced = _.debounce(syncFunc, waitMs, {maxWait: maxWaitMs});
		pmArr.forEach(pm => pm.syncServerDebounced = syncServerDebounced);
		
		return pmArr;
	}
	
	hasChanges() {
		for (var cid in this.changes) {
			return true;
		}
		return false;
	}
	
	mergeChanges() { //merge changes copiado (copia de envio) com possiveis changes que usuario fez durante tentativa de sync
		console.log(this.name, this.changes, this.changesCopy);
		//mais eficiente pegar mudancas do changes (que devem ser poucas), passar pro changesCopy e atribuir referencia ao changes:
		for (var cid in this.changes) {
			if (this.changes[cid] === true) { //SE eh para deletar cid
				this.changesCopy[cid] = true;
			} else { //SE nao: assume que eh object
				this.changesCopy[cid] ??= {};
				for (var prop in this.changes[cid]) {
					this.changesCopy[cid][prop] = true;
				}
			}
		}
		this.changes = this.changesCopy;
	}
	
	static hasError(result) {
		if (typeof result == "object") {
			for (var info of result) {
				if (info.erro) {
					return true;
					// console.warn(info.erro);
				}
			}
			
			return false;
		} else {
			return true;
		}
	}
	
	static showError(result) {
		var ret = true;
		if (typeof result == "object") {
			for (var info of result) {
				if (info.erro) {
					hoverMessage("Sync incompleto. Tente novamente mais tarde.", {"background-color": "#FF0"});
					console.warn(info.erro);
					
					ret = false;
				}
			}
		}
		
		return ret;
	}
	
	showPieceElems(parent, filterFunc, sortFunc) { //cria e poe pieceElems no parent (boa pratica: parent apenas ter pieceElems como suas children); pode filtrar e reordenar
		var pieceCidArr = this.getPieceCidArr();
		if (filterFunc) pieceCidArr = pieceCidArr.filter(x => filterFunc(x[0]));
		if (sortFunc) pieceCidArr.sort((x, y) => sortFunc(x[0], y[0]));
		var cids = pieceCidArr.map(x => x[1]);
		var elemArr = cids.map(cid => this.createPieceElem(cid));
		if (parent) parent.replaceChildren(...elemArr); //pode nao enviar parent, o que significa que nao precisa dar replace aqui
		
		return elemArr;
	}
	
	setChangesToAll() { //marca que eh para enviar tudo pro server; nao refaz deletados se tiver prop=NULL no db
		this.changes = JSON.parse(JSON.stringify(this.pieces));
		for (var cid in this.changes) {
			var obj = this.changes[cid];
			for (var key in obj) {
				obj[key] = true;
			}
		}
	}
	
}

