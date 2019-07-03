import { LitElement, html, css } from 'lit-element';

export class UploaderElement extends LitElement {

    static get properties() { return {
        url: {type: String},
        disabled: {type: Boolean},
        accept: {type: String},
        multiple: {type: Boolean},
        placeholder: {type: String},
        files: {type: Array},
        dragging: {type: Boolean, reflect: true },
        uploading: {type: Boolean, reflect: true }
    }}

    static get styles(){ return css`
        :host {
            --hoverBgd: rgba(255,236,179 ,.7);
            --uploadingBgd: rgba(238,238,238 ,.8);
            --progressBgd: var(--hoverBgd);
            --hoverColor: currentColor;
            --uploadingColor: currentColor;
            background: var(--hoverBgd);
            width: 100%;
            height: 100%;
            display: block;
            position: absolute;
            z-index: 10000;
            left: 0;
            top: 0;
            visibility: hidden;
            /* pointer-events: none; */
        }

        :host([dragging]),
        :host([uploading]) {
            visibility: visible;
        }

        .placeholder {
            color: var(--hoverColor)
        }

        .progress {
            color: var(--uploadingColor)
        }

        .placeholder,
        .progress {
            position: absolute;
            height: 100%;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: bold;
        }
        
        :host([uploading]) {
            background: var(--uploadingBgd);
        }

        :host(:not([dragging])) .placeholder,
        :host(:not([uploading])) .progress {
            display: none;
        }

        .progress > div {
            position: relative
        }

        .progress .bar {
            position: absolute;
            height: 100%;
            left: 0;
            background: var(--progressBgd);
        }

        .choose {
            display: none;
        }
    `}

	constructor(){
		super()

        this.url = '';
        this.disabled = false
        this.accept = '';
        this.multiple = false
        this.placeholder = 'Drop to upload';
        this.files = []
        this._numUploading = 0
        this._numUploaded = 0
        this.dragging = false;
        this.uploading = false;

        ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(fn=>{
            this[fn] = this['_'+fn].bind(this)
        })
	}

    get progress(){
        return this.files.length > 0 ? (this._numUploaded / this.files.length * 100) : 0
    }

    get autoUpload(){ return this.hasAttribute('auto-upload') }

    render(){ return html`
        <input class="choose" type="file" @click=${e=>e.stopPropagation()} @change=${this._inputChange} accept=${this.accept} ?multiple=${this.multiple}>
        <div class="placeholder">${this.placeholder}</div>
        <div class="progress">
            <div class="bar" style="width:${this.progress}%"></div>
            <div>
                <b-spinner></b-spinner>
                Uploading ${this._numUploading} of ${this.files.length}
            </div>
        </div>
    `}

    connectedCallback(){
        super.connectedCallback();

        this.parent = this.parentElement
        this.parent.addEventListener('dragenter', this.dragenter, true)
        this.addEventListener('dragleave', this.dragleave, true)
        this.addEventListener('dragover', this.dragover, true)
        this.addEventListener('drop', this.drop, true)
    }

    disconnectedCallback(){
        super.disconnectedCallback()
        this.parent.removeEventListener('dragenter', this.dragenter)
        this.removeEventListener('dragleave', this.dragleave)
        this.removeEventListener('dragover', this.dragover)
        this.removeEventListener('drop', this.drop)
    }

    _acceptFile(file){
        let doAccept = true
        let accept = this.accept
        if( !accept ) return true
        return accept.split(',').find(patt=>{
            patt = patt.trim()
            if( patt[0] == '.' )
                return new RegExp(patt+'$').test(file.name)
            else
                return new RegExp(patt).test(file.type)
        })
    }

    chooseFile(){
        if( this.disabled ) return
        this.shadowRoot.querySelector('.choose').click()
    }

    _drop(e){
        e.preventDefault()
        this.dragging = false
        this._selectFiles(e.dataTransfer.files)
    }

    _inputChange(e){
        this._selectFiles(e.target.files)
    }

    _selectFiles(files){

        if( this.uploading ) return

        files = Array.from(files)
        
        if( !this.multiple )
            files = files.slice(0,1)

        let valid = []
        let invalid = []

        files.forEach(file=>{
            if( this._acceptFile(file) )
                valid.push(file)
            else
                invalid.push(file)
        })

        this.files = valid

        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            composed: true,
            detail: {
                invalid: invalid.length > 0 ? invalid : false
            }
        }))

        if( this.autoUpload && this.url ){
            this.upload()
        }

    }

    _dragover(e){
        e.preventDefault() // needed to allow `drop` event to trigger
    }

    _dragenter(e){
        if( this.disabled || !e.dataTransfer.types.includes('Files') ) return
        this.dragging = true
    }

    _dragleave(e){
        this.dragging = false
    }

    async upload({ url='', method='POST', fileKey='file', formData={} }={}){

        if( this.uploading )
            throw new Error("Already uploading")

        url = url || this.url
        
        if( !url )
            throw new Error("Missing URL")

        this._numUploading = 0
        this._numUploaded = 0
        this.uploading = true

        let resp = []

        for( let file of this.files ){

            let _formData = new FormData();

            _formData.append(fileKey, file)

            for( let key in formData )
                _formData.append(key, formData[key])

            this._numUploading++
            this.requestUpdate()

            let uploadResp = await fetch(url, {
                method: method,
                body: _formData
            })
            .then(resp=>resp.json())
            .then(resp=>{
                this._numUploaded++
                this.requestUpdate()
                return resp
            })

            resp.push(uploadResp)
        }

        this._numUploading = 0
        this._numUploaded = 0
        this.files = []
        this.uploading = false

        this.dispatchEvent(new CustomEvent('upload', {
            bubbles: true,
            composed: true,
            detail: resp
        }))

        return this.multiple ? resp : resp[0]
    }

}
    
customElements.define('b-uploader', UploaderElement)
