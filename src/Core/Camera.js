import { PerspectiveCamera } from "three";
import EventEmitter from "../Utils/EventEmitter";
import App from "../App";
import { OrbitControls } from "three/examples/jsm/Addons.js";

export default class Camera extends EventEmitter {
    constructor() {
        super()

        this.app = new App()

        this.perspective = null
        this.controls = null

        this.resizeHandlerBound = this.resizeHandler.bind(this)

        this.init()
    }

    init() {
        this.perspective = new PerspectiveCamera(90, this.app.canvasSize.aspect, 0.1, 100)
        this.perspective.position.set(0, 0, 5)

        this.controls = new OrbitControls(this.perspective, this.app.canvas)

        this.app.canvasSize.on('resize', this.resizeHandlerBound)
    }

    resizeHandler(data) {
        const {aspect} = data

        this.perspective.aspect = aspect
        this.perspective.updateProjectionMatrix()
    }

    destroy() {
        this.app.canvasSize.off('resize')

        this.perspective = null
        this.controls = null

        this.resizeHandlerBound = null

        this.app = null
    }
} 