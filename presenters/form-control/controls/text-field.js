import {css} from 'lit-element'
import moment from 'moment'
import Dialog from '../../dialog'
import './date-picker'

const styles = css`
:host {
	display: inline-block;
	contain: content;
	min-width: .25em;
}

:host(:not([disabled])){
	cursor: text;
}

:host(:not([disabled])) main ::selection {
	background: var(--selectionBgd, #FFF8E1);
}

main {
	display: flex;
}

.editor {
	outline: none;
	width: 100%;
	display: inline-block;
	white-space: pre-wrap;
	min-height: 1em;
	line-height: 1.2em;
	margin: -.1em 0;
}

/* :host([single-line]) .editor {
	white-space: nowrap;
	overflow-x: auto;
	overflow-x: -moz-scrollbars-none; 
}

:host([single-line]) .editor::-webkit-scrollbar {
	width: 0 !important;
} */

.editor:empty:before {
	content: attr(data-placeholder);
	color: var(--placeholderColor);
}

.calendar {
	display: none;
	opacity: .3;
	height: 1.2em;
    margin: -0.3em -.5em -.5em 0;
    padding: .25em;
	cursor: pointer;
}

:host([type="date"]) .calendar {
	display: inline-block;
}

.calendar:hover,
.calendar.popover-open {
	opacity: .7;
}`

class TextFieldElement extends HTMLElement {
	
	constructor() {
        super()
		
        let shadow = this.attachShadow({mode: 'open'})
        let temp = document.createElement('template')
		
		let placeholder = this.getAttribute('placeholder') || ''
		
        temp.innerHTML = `<style>${styles.cssText}</style>
			<main>
				<div class="editor" contenteditable="true" data-placeholder="${placeholder}"></div>
				<b-icon name="calendar-3" class="calendar"></b-icon>
			</main>
			<slot id="value"></slot>`
			
        this.shadowRoot.appendChild(temp.content.cloneNode(true));
		
		let value = this.$('#value')
		this._val = value.assignedNodes().map(el=>el.textContent.trim()).join(' ')
		this._val = this._val.replace(/^\n|\n$/g, '').trim()
		
		this._editor = this.$('.editor')

		if( this.type == 'date' ){
			this._datePicker = document.createElement('date-picker')
			this._datePicker.value = this.value
			this._datePicker.format = this.getAttribute('format') || 'MM/DD/YYYY'

			if( !this._datePicker.isValid ){
				let date = moment(this._val)
				this._val = this._datePicker.value = date.format(this._datePicker.format)
			}
		}
		
		this._editor.innerHTML = this._val
		this.innerText = ''
		
		this._editor.addEventListener('paste', this._onPaste.bind(this), true)
		this._editor.addEventListener('keydown', this._onKeypress.bind(this), true)
		this._editor.addEventListener('focus', this._onFocus.bind(this))
		this._editor.addEventListener('blur', this._onBlur.bind(this))

		this.shadowRoot.addEventListener('click', this._onClick.bind(this))
		this.addEventListener('click', this._onClick.bind(this))
    }
	
	$(str){ return this.shadowRoot.querySelector(str)}
	$$(str){ return this.shadowRoot.querySelectorAll(str)}
	
	connectedCallback(){
		this._setClassNames()
	}
	
	disconnectedCallback(){}
	
	static get observedAttributes() { return ['disabled']; }
	attributeChangedCallback(name, oldValue, newValue){
		
		if( name === 'disabled' )
			this._editor.contentEditable = !this.disabled
	}
	
	get type(){ return this.getAttribute('type') }

	get disabled(){ return this.hasAttribute('disabled') }
	set disabled(val=true){val ? this.setAttribute('disabled', '') : this.removeAttribute('disabled')}
	get value(){ return this._val}

	get textValue(){
		if( !this.value ) return this.value
		let doc = (new DOMParser()).parseFromString(this.value, 'text/html')
		return Array.from(doc.body.childNodes).map(node=>node.nodeValue||node.innerText).join("\n")
	}
	
	set value(val){
		
		this._oldVal = this._val
		
		if( this.hasAttribute('default') && !val ){
			val = this.getAttribute('default')
			
			this._val = val
			
			let selection = this.select()
			document.execCommand('insertText', false, val)
			selection.removeAllRanges();
		}else{

			if( this.type == 'date' ){
				this._datePicker.value = val
	
				if( !this._datePicker.isValid ){
					let date = moment(val)
					val = this._datePicker.value = date.format(this._datePicker.format)
				}

				if( !this._datePicker.isValid ){
					val = this._val
					this._datePicker.value = val
				}

			}

			this._val = val
			this._editor.innerHTML = val
		}
		
		this._setClassNames()
	}

	get dbValue(){
		if( this._datePicker )
			return this.value ? this._datePicker.formatted('YYYY-MM-DD') : this.value
		return this.value
	}

	get currentValue(){
		return this._editor.innerText || this._editor.innerHTML
	}
	
	set isInvalid(invalid){
		this._isInvalid = invalid
		if( invalid )
			this.setAttribute('invalid', true)
		else
			this.removeAttribute('invalid')
	}
	
	get isInvalid(){
		return this._isInvalid
	}
	
	get isFocused(){
		return this.shadowRoot.activeElement == this._editor
	}
	
	_setClassNames(){
		
		if( !this._val || this._val === '0' )
			this.setAttribute('falsy', true)
		else
			this.removeAttribute('falsy')
			
			if( !this._val )
			this.setAttribute('no-value', true)
		else
			this.removeAttribute('no-value')
			
		if( !this._val && !this.getAttribute('placeholder') )
			this.setAttribute('empty', true)
		else
			this.removeAttribute('empty')
	}
	
	_onClick(e){

		// was calendar icon clicked?
		if( e.target.classList.contains('calendar') ){
			e.stopPropagation()
			return this.pickDate()
		}

		if( e.target != this )
			return

		if( !e.target.isFocused )
			this.focus()
	}

	async pickDate(){
		this._datePicker.value = this.value
		let picker = new Dialog({view: this._datePicker, btns: ['cancel', 'ok']})

		if( await picker.popover(this.$('.calendar'), {align: 'left', overflowBoundry: 'window', maxHeight: false}) ){
			this._changeValue(picker.$('date-picker').value)
		}
	}
	
	_onPaste(e){
		e.preventDefault();
		let val = e.clipboardData.getData('text')
		document.execCommand('inserttext', false, val);
	}
	
	select(range='all'){

		let el = this._editor,
		    s = window.getSelection(),
		    r = document.createRange();
		
		if( range == 'start' ){
			r.setStart(el, 0);
			r.setEnd(el, 0);
		}else if( range == 'end' ){
			r.setStart(el, el.childNodes.length);
			r.setEnd(el, el.childNodes.length);
		}else{
			r.selectNodeContents(el);
		}
		
		s.removeAllRanges();
		s.addRange(r);
		return s
	}
	
	_onKeypress(e){
		let stop = false
		
		this.isInvalid = false
		
		if( e.key == 'Enter' && !this.hasAttribute('multiline')){
			stop = true
			this.blur() // will trigger a change if there is one
		}
		
		if( e.key == 'Escape' ){
			this.value = this.value // reset the value
			this.blur()
		}
			
		let max = this.getAttribute('max')
		if( max && this._editor.innerText.length >= max )
			stop = true

		if( stop ){
			e.preventDefault()
		}else if( !this.hasAttribute('bubble-keypress') ){
			e.stopPropagation()
		}
	}
	
	_onFocus(){
		
	}
	
	focus(){
		this.select()
	}
	
	validate(val){
		
		let required = this.hasAttribute('required')
		let validate = this.getAttribute('validate')
		
		if( !validate ) return required ? !!val : true
		
		switch(validate){
			case 'int':
				validate = '^\\d+$'; break;
			case 'float':
			case 'decimal':
				validate = '^\\d+(\\.\\d*)?$|^\\.\\d+$'; break;
			case 'email':
				validate = '^\\S+@\\S+\\.\\S+$'; break;
		}
		
		return !required && !val ? true : (new RegExp(validate)).test(val)
	}
	
	_onBlur(){
		
		let val = this.currentValue
		
		if( !this.validate(val) ){
			
			if( this.hasAttribute('reset-invalid') ){
				this.value = this.value
			}else{
				this.value = val
				this.isInvalid = true
				this._setClassNames()
			}
			// }else{
			// 	
			// 	this.focus()
			// }
			return
		}
		
		if( val == this.value )
			return
		
		let max = this.getAttribute('max')
		if( max )
			val = val.slice(0, max)
		
		this._changeValue(val)
	}

	_changeValue(val){
		this.value = val
		
		var event = new CustomEvent('change', {
			bubbles: true,
			composed: true,
			detail: {
				value: this.value,
				oldVal: this._oldVal
			}
		});
		
		this.dispatchEvent(event)
	}
}

customElements.define('text-field', TextFieldElement)

export default customElements.get('text-field')
