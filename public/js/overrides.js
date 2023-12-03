const OverridesDebug = {
	objMethods: [],
	objMethodsNew: [],
	obj: null,
	
	init(obj) { //lista overrides feitos, para ver se algum nome ja existia; ex: Node.prototype
		this.obj = obj;
		for (var m in obj) {
			this.objMethods.push(m);
		}
	},
	
	compare() {
		for (var m in this.obj) {
			if (!this.objMethods.includes(m)) {
				this.objMethodsNew.push(m);
			}
		}
		console.log(this.objMethodsNew);
	},
	
};

// OverridesDebug.init(Node.prototype);

Object.assign(Node.prototype, {
	index() { //deprecated
		return [...this.parentNode.children].indexOf(this);
	},
	
	getOrder() {
		return [...this.parentNode.children].indexOf(this);
	},
	
	setOrder(idx) { //aceita idx negativo
		var parent = this.parentNode;
		var children = parent.children;
		var len = children.length;
		
		if (idx >= len) {
			parent.append(this);
		} else if (idx >= 0) {
			children[idx].before(this);
		} else {
			idx = len + idx;
			if (idx > 0) {
				children[idx].after(this);
			} else {
				parent.prepend(this);
			}
		}
		
		return this;
	},
	
	insertInto(parent, idx = -1) { //poe dentro de parent e define a ordem
		parent.append(this);
		this.setOrder(idx);
		return this;
	},
	
	createAppend(tagOrBase, attrObj, styleObj) {
		var elem = createElem(tagOrBase, attrObj, styleObj);
		this.appendChild(elem);
		return elem;
	},
	
	createAppendSvg(tagOrBase, attrObj, styleObj) {
		var elem = createSvg(tagOrBase, attrObj, styleObj);
		this.appendChild(elem);
		return elem;
	},
	
	closestFunc(testFunc) {
		var elem = this;
		
		while (!testFunc(elem) && elem != null) {
			elem = elem.parentNode;
		}
		
		return elem;
	},
	
	childrenMatches(selector) {
		return this.children.filter(child => child.matches(selector));
	},
	
	prevSiblingsMatching(filterFuncOrSelector, maxQuant = 1) {
		var ret = [];
		var currElem = this.previousElementSibling;
		
		if (typeof filterFuncOrSelector == "string") {
			var selector = filterFuncOrSelector;
			
			while (currElem != null && ret.length < maxQuant) {
				if (currElem.matches(selector)) {
					ret.push(currElem)
				}
				
				currElem = currElem.previousElementSibling;
			}
		} else {
			var filterFunc = filterFuncOrSelector;
			
			while (currElem != null && ret.length < maxQuant) {
				if (filterFunc(currElem)) {
					ret.push(currElem)
				}
				
				currElem = currElem.previousElementSibling;
			}
		}
		
		return ret;
	},
	
	nextSiblingsMatching(filterFuncOrSelector, maxQuant = 1) {
		var ret = [];
		var currElem = this.nextElementSibling;
		
		if (typeof filterFuncOrSelector == "string") {
			var selector = filterFuncOrSelector;
			
			while (currElem != null && ret.length < maxQuant) {
				if (currElem.matches(selector)) {
					ret.push(currElem)
				}
				
				currElem = currElem.nextElementSibling;
			}
		} else {
			var filterFunc = filterFuncOrSelector;
			
			while (currElem != null && ret.length < maxQuant) {
				if (filterFunc(currElem)) {
					ret.push(currElem)
				}
				
				currElem = currElem.nextElementSibling;
			}
		}
		
		return ret;
	},
	
	//metodos de mexer com valores padrao:
	getValue() {
		if (this.tagName == "SPAN") {
			return this.innerText;
		} else if (this.tagName == "DIV" || this.tagName == "svg") {
			return this.innerHTML;
		} else if (this.type == "checkbox") {
			return this.checked
			
		} else if (this.type == "date") {
			return this.value === "" ? null : this.value;
		} else if (this.type == "time") {
			return this.value === "" ? null : this.value;
		} else if (this.type == "datetime-local") {
			return this.value === "" ? null : moment(this.value, "YYYY-MM-DDTHH:mm").format("YYYY-MM-DD HH:mm:ss");
			
		} else if (this.type == "number") {
			return this.value === "" ? null : (this.step == "any" ? parseFloat(this.value) : parseInt(this.value));
			
		} else if (this.multiple) {
			return this.selectedOptions.map(opt => opt.value).join(",");
		} else if (this.tagName == "IMG" || this.tagName == "IFRAME" || this.tagName == "AUDIO" || this.tagName == "VIDEO") {
			return this.src;
		} else {
			return this.value;
		}
	},
	
	setValue(value) {
		if (this.tagName == "SPAN") {
			if (typeof value == "boolean") {
				this.innerText = value ? "Sim" : "Não";
			} else {
				this.innerText = value;
			}
		} else if (this.tagName == "DIV" || this.tagName == "svg") {
			this.innerHTML = value;
		} else if (this.type == "checkbox") {
			this.checked = value;
			
		} else if (this.type == "date") {
			this.value = value == null ? "" : moment(value, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("YYYY-MM-DD");
		} else if (this.type == "time") {
			this.value = value == null ? "" : moment(value, "HH:mm").format("HH:mm");
		} else if (this.type == "datetime-local") {
			this.value = value === "" ? null : moment(value, ["YYYY-MM-DD HH:mm:ss", "DD/MM/YYYY HH:mm:ss"]).format("YYYY-MM-DDTHH:mm");
			
		} else if (this.multiple) {
			var arr = value === null ? [] : value.split(",");
			this.options.forEach(opt => opt.selected = arr.includes(opt.value));
		} else if (this.tagName == "IMG" || this.tagName == "IFRAME" || this.tagName == "AUDIO" || this.tagName == "VIDEO") {
			this.src = value;
		} else {
			this.value = value;
		}
	},
	
	getValues() {
		return this.querySelectorAll("[data-field]").getValues();
	},
	
	setValues(dbObj) {
		this.querySelectorAll("[data-field]").setValues(dbObj);
	},
	
	makeFilledArr(dbObjArr) { //faz clones e preenche
		return dbObjArr.map(dbObj => {
			var clon = this.cloneNode(true);
			clon.setValues(dbObj);
			return clon;
		});
	},
	
	//animacoes:
	async transition(time, cssObj, easing = "ease-in-out") {
		// await mainlib.sleep(50); //sem isso, algumas transitions logo apos mostrar elemento nao funcionam
		await mainlib.sleep(20); //testando tempo menor
		
		if (typeof cssObj == "string") { //SE eh string: tem valores e props
			var obj = helpers.cssStrToObj(cssObj);
			
			// console.log(obj);
			this.style.transition = Object.keys(obj).map(k => k + " " + time + "ms " + easing).join(","); ///ou tacar all mesmo
			Object.assign(this.style, obj);
		} else { //SE nao: assume que eh objeto com pares key-value
			this.style.transition = Object.keys(cssObj).map(k => k + " " + time + "ms " + easing).join(","); ///ou tacar all mesmo
			Object.assign(this.style, cssObj);
		}
		
		await mainlib.sleep(time);
		this.style.transition = ""; ///guardar e devolver valor anterior?
	},
	
	async animateForwards(keyFrameArr, animMsOrOptions) {
		var options = {
			fill: "forwards",
			easing: "ease-in-out",
			composite: "add",
		};
		
		if (typeof animMsOrOptions == "object") { //SE enviou object
			var options = {
				...options,
				...animMsOrOptions,
			};
		} else { //SE nao: assume que eh numero
			var options = {
				...options,
				duration: animMsOrOptions,
			}
		}
		
		var animation = this.animate(keyFrameArr, options);
		await animation.finished;
		animation.commitStyles();
		animation.cancel();
	},
	
	styleAssign(css, isToPutPx) { //diz se eh para completar numeros de propriedades especiais com px
		if (typeof css == "string") {
			css = helpers.cssStrToObj(css);
		}
		
		if (isToPutPx) {
			var possibleProps = "width height left top right bottom margin padding font-size".split(" ");
			for (var prop in css) {
				if (possibleProps.includes(prop)) {
					var value = css[prop];
					
					if (parseInt(value) != value || value.includes("%")) { //SE nao mandou numero: ja tem unidade e eh para deixar
						
					} else { //SE eh numero: assume que deve por px no final
						css[prop] = value + "px";
					}
				}
			}
		}
		
		Object.assign(this.style, css);
	},
	
	
	setAttributes(obj) {
		for (var attr in obj) {
			this.setAttribute(attr, obj[attr]);
		}
	},
	
	isInViewport() {
		var rect = this.getBoundingClientRect();
		return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
	},
	
	fireEvent(eventName) { //dispatch evento que sempre bubblea
		this.dispatchEvent(new Event(eventName, {bubbles: true, cancelable: true}));
	},
	
	classes(add, remove, toggle) {
		if (add) {
			this.classList.add(...add.split(" "));
		}
		if (remove) {
			this.classList.remove(...remove.split(" "));
		}
		if (toggle) {
			for (var c of toggle.split(" ")) {
				this.classList.toggle(c);
			}
		}
	},
	
	haveWidth(value) {
		// var valueBefore = this.offsetWidth;
		// this.style.width = (value == null ? valueBefore : value) + "px";
		// return valueBefore;
		
		var valueBeforePx = getComputedStyle(this).width; //as vezes retorna "auto"
		var valueBefore = valueBeforePx.replace("px", "");
		this.style.width = (value == null ? valueBeforePx : value + "px") ;
		return valueBefore;
	},
	
	haveHeight(value) {
		// var valueBefore = this.offsetHeight;
		// this.style.height = (value == null ? valueBefore : value) + "px";
		// return valueBefore;
		
		var valueBeforePx = getComputedStyle(this).height; //as vezes retorna "auto"
		var valueBefore = valueBeforePx.replace("px", "");
		this.style.height = (value == null ? valueBeforePx : value + "px") ;
		return valueBefore;
	},
	
});

function createElem(tagOrBase, attrObj, styleObj) {
	if (typeof tagOrBase == "string") { //SE enviou string: eh tagName
		var dotIndex = tagOrBase.indexOf(".");
		var colonIndex = tagOrBase.indexOf(":");
		
		if (dotIndex != -1) {
			var className = tagOrBase.slice(dotIndex + 1);
			if (colonIndex != -1) { //:.
				var tagName = tagOrBase.slice(0, colonIndex);
				var type = tagOrBase.slice(colonIndex + 1, dotIndex);
			} else { //.
				var tagName = tagOrBase.slice(0, dotIndex);
			}
		} else {
			if (colonIndex != -1) { //:
				var tagName = tagOrBase.slice(0, colonIndex);
				var type = tagOrBase.slice(colonIndex + 1);
			} else { //nada
				var tagName = tagOrBase;
			}
		}
		
		var elem = document.createElement(tagName);
		if (type) elem.type = type;
		if (className) elem.className = className;
	} else { //SE nao: assume objeto a ser clonado
		var elem = tagOrBase.cloneNode(true);
	}
	
	//propriedades que podem vir dentro de atributos:
	if (attrObj) {
		for (var p of ["text", "value", "innerText", "innerHTML"]) {
			if (p in attrObj) {
				elem[p] = attrObj[p];
				delete attrObj[p];
			}
		}
		elem.setAttributes(attrObj);
	}
	
	elem.styleAssign(styleObj);
	
	return elem;
}

function createSvg(tagOrBase, attrObj, styleObj) {
	if (typeof tagOrBase == "string") {
		var dotIndex = tagOrBase.indexOf(".");
		
		if (dotIndex != -1) {
			var className = tagOrBase.slice(dotIndex + 1);
			var tagName = tagOrBase.slice(0, dotIndex);
		} else {
			var tagName = tagOrBase;
		}
		
		var elem = document.createElementNS("http://www.w3.org/2000/svg", tagName);
		if (className) elem.setAttribute("class", className); //note que atribuir class com .className nao funciona para elementos svg
	} else {
		var elem = tagOrBase.cloneNode(true);
	}
	
	//propriedades que podem vir dentro de atributos:
	if (attrObj) {
		for (var p of ["textContent"]) {
			if (p in attrObj) {
				elem[p] = attrObj[p];
				delete attrObj[p];
			}
		}
		elem.setAttributes(attrObj);
	}
	
	elem.styleAssign(styleObj);
	
	return elem;
}

Object.assign(HTMLTableElement.prototype, {
	cells(i, j, tbdIdx = 0) {
		return this.tBodies[tbdIdx].rows[i].cells[j];
	},
	
	columns(j) {
		var cols = [];
		for (var i = 0; i < this.rows.length; i++) {
			cols.push(this.rows[i].cells[j]);
		}
		return cols;
	},
	
	toArray(mapFunc) {
		///pegar de tBody em vez de table inteira
		var rowsArr = [];
		for (var i = 0; i < this.rows.length; i++) {
			var cellsArr = [];
			for (var j = 0; j < this.rows[i].cells.length; j++) {
				cellsArr.push(this.rows[i].cells[j]);
			}
			rowsArr.push(cellsArr);
		}
		
		if (mapFunc) {
			for (var i = 0; i < rowsArr.length; i++) {
				for (var j = 0; j < rowsArr[i].length; j++) {
					rowsArr[i][j] = mapFunc(rowsArr[i][j], i, j);
				}
			}
		}
		
		return rowsArr;
	},
	
});

var elemListMethods = {
	getValues() {
		var dbObj = {};
		[...this].forEach(child => {
			var field = child.dataset.field;
			var value = child.getValue();
			dbObj[field] = value;
		});
		return dbObj;
	},
	
	setValues(dbObj) {
		[...this].forEach(child => {
			var field = child.dataset.field;
			if (field in dbObj) {
				var value = dbObj[field];
				child.setValue(value);
			}
		});
	},
	
	toDbeArr(filterFunc) {
		if (filterFunc) {
			return this.map(child => child.querySelectorAll("[data-field]").filter(filterFunc).getValues());
		} else {
			return this.map(child => child.getValues());
		}
	},
	
	includes(...args) {
		return [...this].includes(...args);
	},
	
	map(...args) {
		return [...this].map(...args);
	},
	
	forEach(...args) {
		return [...this].forEach(...args);
	},
	
	filter(...args) {
		return [...this].filter(...args);
	},
	
	some(...args) {
		return [...this].some(...args);
	},
	
	every(...args) {
		return [...this].every(...args);
	},
	
	find(...args) {
		return [...this].find(...args);
	},
	
	indexOf(...args) {
		return [...this].indexOf(...args);
	},
	
	slice(...args) {
		return [...this].slice(...args);
	},
	
	at(...args) {
		return [...this].at(...args);
	},
	
	
	sort(...args) { //nao afeta NodeList original, entao precisa por return array em outra var
		return [...this].sort(...args);
	},
	
	reverse(...args) { //nao afeta NodeList original, entao precisa por return array em outra var
		return [...this].reverse(...args);
	},
	
	splice(...args) { //nao retorna os retirados, como o splice original faz, e sim retorna o array modificado
		// return [...this].splice(...args);
		var newArr = [...this];
		newArr.splice(...args);
		return newArr;
	},
	
};
Object.assign(HTMLCollection.prototype, elemListMethods); //ex: xxx.children, xxx.rows, xxx.getElementsByClassName
Object.assign(NodeList.prototype, elemListMethods); //ex: xxx.querySelectorAll()

Object.assign(Array.prototype, {
	toDbeArr: elemListMethods.toDbeArr,
	
	getValues: elemListMethods.getValues,
});


function qs(selector) {
	return document.querySelector(selector);
}

function qsa(selector) {
	return document.querySelectorAll(selector);
}

Object.assign(Node.prototype, {
	qs(selector) {
		return this.querySelector(selector);
	},
	
	qsa(selector) {
		return this.querySelectorAll(selector);
	},
	
});


//completa libs:
if (typeof swal != "undefined") {
	swal.selectAllCurrent = function() { //seleciona todo o texto do box sendo mostrado agora
		var inputText = qs(".swal-content__input");
		inputText.setSelectionRange(0, inputText.value.length);
		inputText.fireEvent("input"); //BUG: sem isso retorna vazio; https://github.com/t4t5/sweetalert/issues/764
	};
}



// OverridesDebug.compare();

