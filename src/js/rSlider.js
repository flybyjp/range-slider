function copy_touch({identifier, pageX, pageY}){
	return {identifier, pageX, pageY};
}

function find_touch_idx_by_id(target_touch, touch_list){
	for (let i = 0; i < touch_list.length; i++){
		if (touch_list[i].identifier == target_touch.identifier){
			return i;
		}
	}
	return -1;
}

(function () {
	'use strict';

	var RS = function (conf) {
		this.input 			= null;
		this.inputDisplay 	= null;
		this.slider 		= null;
		this.sliderWidth	= 0;
		this.sliderLeft		= 0;
		this.pointerWidth	= 0;
		this.pointerR		= null;
		this.pointerL		= null;
		this.activePointer	= null;
		this.selected 		= null;
		this.scale 			= null;
		this.step 			= 0;
		this.tipL			= null;
		this.tipR			= null;
		this.timeout		= null;
		this.valRange		= false;
		this.ongoing_touch = null;

		this.values = {
			start:	null,
			end:	null
		};
		this.conf = {
			target: 	null,
			values: 	null,
			set: 		null,
			range: 		false,
			width: 		null,
			scale:		true,
			labels:		true,
			tooltip:	true,
			step: 		null,
			disabled:	false,
			onChange:	null,
			onDrop: null,
		};

		this.cls = {
			container:	'rs-container',
			background: 'rs-bg',
			selected: 	'rs-selected',
			pointer: 	'rs-pointer',
			scale: 		'rs-scale',
			noscale:	'rs-noscale',
			tip: 		'rs-tooltip'
		};

		for (var i in this.conf) { if (conf.hasOwnProperty(i)) this.conf[i] = conf[i]; }

		this.init();
	};

	RS.prototype.init = function () {
		if (typeof this.conf.target === 'object') this.input = this.conf.target;
		else this.input = document.getElementById(this.conf.target.replace('#', ''));

		if (!this.input) return console.log('Cannot find target element...');

		this.inputDisplay = getComputedStyle(this.input, null).display;
		this.input.style.display = 'none';
		this.valRange = !(this.conf.values instanceof Array);

		this.is_touch = 'ontouchstart' in window;

		if (this.valRange) {
			if (!this.conf.values.hasOwnProperty('min') || !this.conf.values.hasOwnProperty('max'))
				return console.log('Missing min or max value...');
		}
		return this.createSlider();
	};

	RS.prototype.createSlider = function () {
		this.slider = createElement('div', this.cls.container);
		this.slider.innerHTML = '<div class="rs-bg"></div>';
		this.selected = createElement('div', this.cls.selected);
		this.pointerL = createElement('div', this.cls.pointer, ['dir', 'left']);
		this.scale = createElement('div', this.cls.scale);

		if (this.conf.tooltip) {
			this.tipL = createElement('div', this.cls.tip);
			this.tipR = createElement('div', this.cls.tip);
			this.pointerL.appendChild(this.tipL);
		}
		this.slider.appendChild(this.selected);
		this.slider.appendChild(this.scale);
		this.slider.appendChild(this.pointerL);

		if (this.conf.range) {
			this.pointerR = createElement('div', this.cls.pointer, ['dir', 'right']);
			if (this.conf.tooltip) this.pointerR.appendChild(this.tipR);
			this.slider.appendChild(this.pointerR);
		}

		this.input.parentNode.insertBefore(this.slider, this.input.nextSibling);

        if (this.conf.width) this.slider.style.height = parseInt(this.conf.width) + 'px';
		this.sliderLeft = this.slider.getBoundingClientRect().top;
		this.sliderWidth = this.slider.clientHeight;
		this.pointerWidth = this.pointerL.clientHeight;

		if (!this.conf.scale) this.slider.classList.add(this.cls.noscale);

		return this.setInitialValues();	
	};

	RS.prototype.setInitialValues = function () {
		this.disabled(this.conf.disabled);

		if (this.valRange) this.conf.values = prepareArrayValues(this.conf);

		this.values.start = 0;
		this.values.end = this.conf.range ? this.conf.values.length - 1 : 0;


		if (this.conf.set && this.conf.set.length && checkInitial(this.conf)) {
			var vals = this.conf.set;

			if (this.conf.range) {
				this.values.start = this.conf.values.indexOf(vals[0]);
				this.values.end = this.conf.set[1] ? this.conf.values.indexOf(vals[1]) : null;
			}
			else this.values.end = this.conf.values.indexOf(vals[0]);
		}
		return this.createScale();
	};

	RS.prototype.createScale = function (resize) {
		this.step = this.sliderWidth / (this.conf.values.length - 1);

		return this.addEvents();
	};

	RS.prototype.updateScale = function () {
		this.step = this.sliderWidth / (this.conf.values.length - 1);

		var pieces = this.slider.querySelectorAll('span');

		for (var i = 0, iLen = pieces.length; i < iLen; i++)
			pieces[i].style.height = this.step + 'px';

		return this.setValues();
	};

	RS.prototype.addEvents = function () {
		var pointers = this.slider.querySelectorAll('.' + this.cls.pointer),
			pieces = this.slider.querySelectorAll('span');

		createEvents(document, 'mousemove touchmove', this.move.bind(this));
		createEvents(document, 'mouseup touchend touchcancel', this.drop.bind(this));

		for (var i = 0, iLen = pointers.length; i < iLen; i++)
			createEvents(pointers[i], 'mousedown touchstart', this.drag.bind(this));

		for (var i = 0, iLen = pieces.length; i < iLen; i++)
			createEvents(pieces[i], 'click', this.onClickPiece.bind(this));

		window.addEventListener('resize', this.onResize.bind(this));

		return this.setValues();
	};

	RS.prototype.drag = function (e) {
		e.preventDefault();

		if (this.conf.disabled) return;

		if ( e.type === 'touchstart' ){
			const touch = e.changedTouches[0];
			this.ongoing_touch = copy_touch(touch);
		}

		var dir = e.target.getAttribute('data-dir');
		if (dir === 'left') this.activePointer = this.pointerL;
		if (dir === 'right') this.activePointer = this.pointerR;

		return this.slider.classList.add('sliding');
	};

	RS.prototype.move = function (e) {
		if (this.activePointer && !this.conf.disabled) {
			let touch = null;
			if(e.type === 'touchmove'){
				const touch_idx = find_touch_idx_by_id(this.ongoing_touch, e.changedTouches);
				if (touch_idx == -1){
					// The touchmove event was not for this instance but the other.
					return;
				}
				touch = e.changedTouches[touch_idx];
			}
			var coordX = e.type === 'touchmove' ? touch.clientY : e.pageY,
				index = coordX - this.sliderLeft - (this.pointerWidth / 2);

			index = Math.round(index / this.step);

			if (index <= 0) index = 0;
			if (index > this.conf.values.length - 1) index = this.conf.values.length - 1;

			if (this.conf.range) {
				if (this.activePointer === this.pointerL) this.values.start = index;
				if (this.activePointer === this.pointerR) this.values.end = index;
			}
			else this.values.end = index;

			return this.setValues();
		}
	};

	RS.prototype.drop = function (e) {
		if(e.type === 'touchend' || e.type === 'touchcancel'){
			if(!(this.activePointer && this.ongoing_touch != null)){
				// The touchup event was not for this instance but the other.
				return;
			}
			const touch_idx = find_touch_idx_by_id(this.ongoing_touch, e.changedTouches);
			if(touch_idx == -1){
				// The touchup event was not for this instance but the other.
				return;
			}
		}
		this.activePointer = null;
		this.ongoing_touch = null;
        if (this.conf.onDrop && typeof this.conf.onDrop === 'function') {			
			this.conf.onDrop();
        }
	};

	RS.prototype.setValues = function (start, end) {
		var activePointer = this.conf.range ? 'start' : 'end';

		if (start != null && this.conf.values.indexOf(start) > -1)
			this.values[activePointer] = this.conf.values.indexOf(start);

		if (end != null && this.conf.values.indexOf(end) > -1)
			this.values.end = this.conf.values.indexOf(end);

		if (this.conf.range && this.values.start > this.values.end)
			this.values.start = this.values.end;

		this.pointerL.style.top = (this.values[activePointer] * this.step - (this.pointerWidth / 2)) + 'px';

		if (this.conf.range) {
			if (this.conf.tooltip) {
				this.tipL.innerHTML = this.conf.values[this.values.start];
				this.tipR.innerHTML = this.conf.values[this.values.end];
			}
			this.input.value = this.conf.values[this.values.start] + ',' + this.conf.values[this.values.end];
			this.pointerR.style.top = (this.values.end * this.step - (this.pointerWidth / 2)) + 'px';
		}
		else {
			if (this.conf.tooltip)
				this.tipL.innerHTML = this.conf.values[this.values.end];
			this.input.value = this.conf.values[this.values.end];
		}

		if (this.values.end > this.conf.values.length - 1) this.values.end = this.conf.values.length - 1;
		if (this.values.start < 0) this.values.start = 0;

		const selected_size = (this.conf.values.length / 2.0 - this.values.end) * this.step;
		const selected_size_abs = selected_size > 0 ? selected_size : -selected_size;
		this.selected.style.height = selected_size_abs + 'px';
		if(selected_size > 0){
			this.selected.style.top = this.values.end * this.step + 'px'
		}else{
			this.selected.style.top = (this.conf.values.length / 2.0) * this.step + 'px';
		}
		
		return this.onChange();
	};

	RS.prototype.onClickPiece = function (e) {

		if (this.conf.disabled) return;

		var idx = Math.round((e.clientY - this.sliderLeft) / this.step);

		if (idx > this.conf.values.length - 1) idx = this.conf.values.length - 1;
		if (idx < 0) idx = 0;

		if (this.conf.range) {
			if (idx - this.values.start <= this.values.end - idx) {
				this.values.start = idx;
			}
			else this.values.end = idx;
		}
		else this.values.end = idx;

		this.slider.classList.remove('sliding');

		return this.setValues();
	};

	RS.prototype.onChange = function () {
		var _this = this;
        if (_this.conf.onChange && typeof _this.conf.onChange === 'function') {			
            return _this.conf.onChange(_this.input.value);
        }
	};

	RS.prototype.onResize = function () {
		this.sliderLeft = this.slider.getBoundingClientRect().top;
		this.sliderWidth = this.slider.clientHeight;
		return this.updateScale();
	};

	RS.prototype.disabled = function (disabled) {
		this.conf.disabled = disabled;
		this.slider.classList[disabled ? 'add' : 'remove']('disabled');
	};

	RS.prototype.getValue = function () {
		return this.input.value;
	};

	RS.prototype.destroy = function () {
		this.input.style.display = this.inputDisplay;
		this.slider.remove();
	};

	var createElement = function (el, cls, dataAttr) {
		var element = document.createElement(el);
		if (cls) element.className = cls;
		if (dataAttr && dataAttr.length === 2)
			element.setAttribute('data-' + dataAttr[0], dataAttr[1]);

		return element;
	},

	createEvents = function (el, ev, callback) {
		var events = ev.split(' ');

		for (var i = 0, iLen = events.length; i < iLen; i++)
			el.addEventListener(events[i], callback);
	},

	prepareArrayValues = function (conf) {
		var values = [],
			range = conf.values.max - conf.values.min;

		if (!conf.step) {
			console.log('No step defined...');
			return [conf.values.min, conf.values.max];
		}

		for (var i = 0, iLen = (range / conf.step); i < iLen; i++)
			values.push(conf.values.min + i * conf.step);

		if (values.indexOf(conf.values.max) < 0) values.push(conf.values.max);

		return values;
	},

	checkInitial = function (conf) {
		if (!conf.set || conf.set.length < 1) return null;
		if (conf.values.indexOf(conf.set[0]) < 0) return null;

		if (conf.range) {
			if (conf.set.length < 2 || conf.values.indexOf(conf.set[1]) < 0) return null;
		}
		return true;
	};

	window.rSlider = RS;

})();

export var rSlider = window.rSlider;
