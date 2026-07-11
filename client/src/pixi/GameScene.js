import * as PIXI from 'pixi.js'
import { Tilemap } from './Tilemap'
import { SpriteManager } from './SpriteManager'
import { LightingSystem } from './LightingSystem'
import { ParticleSystem } from './ParticleSystem'
import { StatusIndicators } from './StatusIndicators'

// Píxeles por unidad de mundo (una casilla de terreno). El backend expresa las
// posiciones en unidades de casilla; el terreno se dibuja a TILE px por casilla,
// así que hay que escalar NPCs/edificios por TILE para que todo quede alineado.
const TILE = 16

// Tamaño total del mundo en casillas (debe coincidir con el terreno del backend).
const WORLD_W = 200
const WORLD_H = 150

// Época -> grupo de estilo arquitectónico
const ERA_GROUP = {
  prehistory: 'ancient', antiquity: 'ancient',
  classical: 'classical', medieval: 'classical',
  renaissance: 'early_modern', industrial: 'early_modern',
  information: 'modern', ai: 'future', space: 'future', singularity: 'future'
}

// Paleta por grupo de época (paredes, tejado, puerta, cristal, acento).
const ERA_STYLE = {
  ancient: { wall: 0xc9a877, wall2: 0xb08e5e, roof: 0x9c7a3f, roof2: 0x7d5f2e, door: 0x6b4626, glass: 0x9ac6b0, accent: 0xcf9f5a },
  classical: { wall: 0xd8c9a8, wall2: 0xc2b189, roof: 0xb5482f, roof2: 0x8a3320, door: 0x5a3a1e, glass: 0x9fdcf0, accent: 0xcf7a3c },
  early_modern: { wall: 0xb5615a, wall2: 0x8f4a44, roof: 0x59606c, roof2: 0x3d4652, door: 0x4a3226, glass: 0xbfe0ea, accent: 0x9aa0a6 },
  modern: { wall: 0xc4cad0, wall2: 0xa6aeb6, roof: 0x8a939c, roof2: 0x6f7982, door: 0x39424a, glass: 0x7fc4e8, accent: 0x5a9fd8 },
  future: { wall: 0x6f86a6, wall2: 0x556a8c, roof: 0x8f7fd8, roof2: 0x6b5fb0, door: 0x2f3a52, glass: 0x9ff0ea, accent: 0x7fe0d8 }
}

const eraPalette = (era) => ERA_STYLE[ERA_GROUP[era] || 'classical'] || ERA_STYLE.classical

/**
 * Escena principal del juego que gestiona todas las capas de renderizado,
 * la cámara y la actualización de entidades.
 */
export class GameScene {
  /**
   * @param {React.RefObject} canvasRef - Referencia al elemento canvas
   * @param {Object|null} terrainData - Datos del terreno generado
   */
  constructor (canvasRef, terrainData) {
    if (!canvasRef?.current) {
      throw new Error('Canvas reference is required')
    }

    this.app = new PIXI.Application({
      view: canvasRef.current,
      width: canvasRef.current.parentElement?.clientWidth || 800,
      height: canvasRef.current.parentElement?.clientHeight || 600,
      backgroundColor: 0x000000,
      antialias: false,
      resolution: globalThis.devicePixelRatio > 1 ? 2 : 1,
      autoDensity: true
    })

    // Capas en orden z
    this.groundLayer = new PIXI.Container()
    this.decoLayer = new PIXI.Container() // props decorativos (bajo los edificios)
    this.buildingLayer = new PIXI.Container()
    this.linkLayer = new PIXI.Container() // líneas de interacción social (bajo los NPCs)
    this.npcLayer = new PIXI.Container()
    this.effectLayer = new PIXI.Container()
    this.fogLayer = new PIXI.Container() // niebla del área no explorada
    this.uiLayer = new PIXI.Container()
    this.lightingOverlay = new PIXI.Container()

    this.app.stage.addChild(
      this.groundLayer,
      this.decoLayer,
      this.buildingLayer,
      this.linkLayer,
      this.npcLayer,
      this.effectLayer,
      this.fogLayer,
      this.uiLayer,
      this.lightingOverlay
    )

    // Inicializar sistemas
    this.tilemap = new Tilemap(this.groundLayer, terrainData)
    this.spriteManager = new SpriteManager()
    this.lighting = new LightingSystem(
      this.lightingOverlay,
      this.app.screen.width,
      this.app.screen.height
    )
    this.particles = new ParticleSystem(this.effectLayer)
    this.indicators = new StatusIndicators(this.uiLayer)

    // Gráfico persistente para las líneas de interacción social (no se destruye por frame).
    this.socialLinkGfx = new PIXI.Graphics()
    this.socialLinkGfx.eventMode = 'none' // decorativo: nunca debe capturar clics
    this.linkLayer.addChild(this.socialLinkGfx)

    // Niebla del área no explorada (se recalcula al cambiar los límites del mundo).
    this.fogGfx = new PIXI.Graphics()
    this.fogGfx.eventMode = 'none' // cubre gran parte del mundo: no debe bloquear clics
    this.fogLayer.addChild(this.fogGfx)
    this.worldPxW = WORLD_W * TILE
    this.worldPxH = WORLD_H * TILE

    // Estado interno
    this.npcSprites = new Map()
    this.npcLabels = new Map() // id -> PIXI.Text con el nombre
    this.buildingGraphics = new Map()
    this.propGraphics = new Map() // id -> gráfico de prop decorativo
    this.prevNPCStates = new Map()

    // Cámara (en unidades de casilla; se convierte a px en updateTransform).
    this.camera = { x: 100, y: 80, zoom: 2 }
    this._cameraCentered = false // se auto-centra en los NPCs al recibir datos

    // Binding de métodos ANTES de registrar los listeners. Si se hace después,
    // addEventListener guarda las versiones SIN bindear y, al dispararse el evento,
    // `this` apunta al canvas/window en vez de a la escena → el arrastre y el zoom
    // no funcionan (era justo el bug de "no me puedo mover en el mapa").
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onWheel = this._onWheel.bind(this)
    this._onTouchStart = this._onTouchStart.bind(this)
    this._onTouchEnd = this._onTouchEnd.bind(this)
    this._onTouchMove = this._onTouchMove.bind(this)

    this._setupCamera()

    // Aplicar la transformación inicial de cámara.
    this.updateTransform()

    // Referencia para depuración desde DevTools:
    //   document.querySelector('canvas').__scene.camera
    canvasRef.current.__scene = this
  }

  /**
   * Configura los eventos de cámara (arrastre y zoom).
   * @private
   */
  _setupCamera () {
    const view = this.app.view

    this._dragging = false
    this._lastPos = { x: 0, y: 0 }

    view.addEventListener('mousedown', this._onMouseDown)
    globalThis.addEventListener('mouseup', this._onMouseUp)
    globalThis.addEventListener('mousemove', this._onMouseMove)
    view.addEventListener('wheel', this._onWheel, { passive: false })

    // Eventos táctiles para dispositivos móviles (ya bindeados en el constructor)
    view.addEventListener('touchstart', this._onTouchStart, { passive: false })
    globalThis.addEventListener('touchend', this._onTouchEnd)
    globalThis.addEventListener('touchmove', this._onTouchMove, { passive: false })
  }

  /** @private */
  _onMouseDown (e) {
    this._dragging = true
    this._lastPos = { x: e.clientX, y: e.clientY }
  }

  /** @private */
  _onMouseUp () {
    this._dragging = false
  }

  /** @private */
  _onMouseMove (e) {
    if (!this._dragging) return
    this._updateCameraPosition(e.clientX, e.clientY)
  }

  /** @private */
  _onWheel (e) {
    e.preventDefault()
    this.camera.zoom = Math.max(
      0.3, // permite alejarse para ver la frontera explorada y la niebla
      Math.min(5, this.camera.zoom - e.deltaY * 0.002)
    )
    this.updateTransform()
  }

  /** @private */
  _onTouchStart (e) {
    if (e.touches.length === 1) {
      e.preventDefault()
      this._dragging = true
      this._lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  /** @private */
  _onTouchEnd () {
    this._dragging = false
  }

  /** @private */
  _onTouchMove (e) {
    if (!this._dragging || e.touches.length !== 1) return
    e.preventDefault()
    this._updateCameraPosition(e.touches[0].clientX, e.touches[0].clientY)
  }

  /** @private */
  _updateCameraPosition (clientX, clientY) {
    // El delta del ratón está en px de pantalla; la cámara está en casillas.
    this.camera.x -= (clientX - this._lastPos.x) / (this.camera.zoom * TILE)
    this.camera.y -= (clientY - this._lastPos.y) / (this.camera.zoom * TILE)
    this._lastPos = { x: clientX, y: clientY }
    this.updateTransform()
  }

  /**
   * Actualiza la transformación del stage según la cámara.
   */
  updateTransform () {
    const stage = this.app.stage
    stage.scale.set(this.camera.zoom)
    // La cámara está en casillas; el mundo se dibuja en px (casilla * TILE).
    stage.position.set(
      this.app.screen.width / 2 - this.camera.x * TILE * this.camera.zoom,
      this.app.screen.height / 2 - this.camera.y * TILE * this.camera.zoom
    )
    this._notifyCamera()
  }

  /**
   * Registra un callback que recibe la cámara en vivo (posición, zoom y viewport
   * en casillas). Lo usa el minimapa para dibujar el recuadro de vista real.
   */
  setCameraListener (fn) {
    this._camListener = fn
    this._notifyCamera()
  }

  /** Centra la cámara en una casilla del mundo (p. ej. clic en el minimapa). */
  centerOn (x, y) {
    this.camera.x = x
    this.camera.y = y
    this.updateTransform()
  }

  /** Notifica la cámara al listener, coalescido a un aviso por frame. @private */
  _notifyCamera () {
    if (!this._camListener || this._camNotifyPending) return
    this._camNotifyPending = true
    requestAnimationFrame(() => {
      this._camNotifyPending = false
      if (!this._camListener || !this.app?.screen) return
      const { x, y, zoom } = this.camera
      this._camListener({
        x,
        y,
        zoom,
        viewW: this.app.screen.width / (zoom * TILE),
        viewH: this.app.screen.height / (zoom * TILE)
      })
    })
  }

  /**
   * Carga (o recarga) el terreno. Necesario porque el terreno llega por WebSocket
   * DESPUÉS de construir la escena, así que no está disponible en el constructor.
   * @param {Object} terrainData - Datos del terreno generado
   */
  setTerrain (terrainData) {
    if (terrainData) {
      this.tilemap.loadFromData(terrainData)
      this.worldPxW = (terrainData.width || WORLD_W) * TILE
      this.worldPxH = (terrainData.height || WORLD_H) * TILE
    }
  }

  /**
   * Actualiza la escena con el estado actual del mundo.
   * @param {Object} worldState - Estado del mundo
   * @param {Function} onSelectNPC - Callback al seleccionar NPC
   * @param {string} timeStr - Hora actual (HH:MM)
   * @param {string} [weather] - Clima actual
   */
  update (worldState, onSelectNPC, timeStr, weather, worldBounds, buildingLabel) {
    if (!worldState) return

    if (buildingLabel) this._buildingLabel = buildingLabel
    this._autoCenterCamera(worldState)
    this._updateProps(worldState)
    this._updateBuildings(worldState, onSelectNPC)
    this._updateNPCs(worldState, onSelectNPC)
    this._updateFog(worldBounds)
    this._updateLighting(timeStr, weather)

    // Actualizar partículas
    this.particles.update()
  }

  /**
   * Oscurece el área NO explorada (fuera de los límites del mundo). A medida que
   * crece la población, los límites se expanden y la niebla se retira → sensación
   * de exploración.
   * @private
   */
  _updateFog (bounds) {
    const g = this.fogGfx
    g.clear()
    if (!bounds) return
    const W = this.worldPxW
    const H = this.worldPxH
    const x0 = bounds.minX * TILE
    const x1 = bounds.maxX * TILE
    const y0 = bounds.minY * TILE
    const y1 = bounds.maxY * TILE

    g.beginFill(0x0a0e18, 0.72)
    g.drawRect(0, 0, W, y0) // arriba
    g.drawRect(0, y1, W, H - y1) // abajo
    g.drawRect(0, y0, x0, y1 - y0) // izquierda
    g.drawRect(x1, y0, W - x1, y1 - y0) // derecha
    g.endFill()

    // Borde tenue de la frontera explorada
    g.lineStyle(2, 0xffe08a, 0.18)
    g.drawRect(x0, y0, x1 - x0, y1 - y0)
  }

  /**
   * Actualiza los sprites de edificios.
   * @private
   */
  _updateBuildings (worldState, onSelectNPC) {
    const buildings = worldState.getBuildings()
    const currentBuildingIds = new Set(buildings.map(b => b.id))

    buildings.forEach(b => {
      let graphic = this.buildingGraphics.get(b.id)
      if (!graphic) {
        graphic = this._createBuildingGraphic(b, this._labelFor(b))
        graphic.eventMode = 'static'
        graphic.cursor = 'pointer'
        const buildingId = b.id
        graphic.on('click', () => onSelectNPC({ kind: 'building', id: buildingId }))
        this.buildingLayer.addChild(graphic)
        this.buildingGraphics.set(b.id, graphic)
      }
      graphic.__building = b
      // Mantener la etiqueta en el idioma actual
      const label = this._labelFor(b)
      if (graphic.__labelText && graphic.__labelText.text !== label) {
        graphic.__labelText.text = label
      }
      graphic.x = (b.Position?.x ?? 0) * TILE
      graphic.y = (b.Position?.y ?? 0) * TILE
    })

    // Eliminar gráficos huérfanos
    this.buildingGraphics.forEach((graphic, id) => {
      if (!currentBuildingIds.has(id)) {
        graphic.removeFromParent()
        graphic.destroy()
        this.buildingGraphics.delete(id)
      }
    })
  }

  /**
   * Actualiza los sprites de NPCs.
   * @private
   */
  _updateNPCs (worldState, onSelectNPC) {
    const npcs = worldState.getNPCs()
    const currentNpcIds = new Set(npcs.map(n => n.id))

    npcs.forEach(npc => {
      let sprite = this.npcSprites.get(npc.id)
      if (!sprite) {
        const variant = this._getSpriteVariant(npc)
        sprite = this.spriteManager.createNPCSprite(variant)
        sprite.eventMode = 'static'
        sprite.cursor = 'pointer'
        // Pasar {kind, id} (no el objeto) para que el panel muestre datos EN VIVO.
        const id = npc.id
        sprite.on('click', () => onSelectNPC({ kind: 'npc', id }))
        this.npcLayer.addChild(sprite)
        this.npcSprites.set(npc.id, sprite)

        // Etiqueta con el nombre encima de la cabeza
        const label = new PIXI.Text(npc.Identity?.name || `#${npc.id}`, {
          fontFamily: 'monospace',
          fontSize: 8,
          fill: 0xffffff,
          stroke: 0x000000,
          strokeThickness: 3,
          align: 'center'
        })
        label.anchor.set(0.5, 1)
        this.uiLayer.addChild(label)
        this.npcLabels.set(npc.id, label)
      }

      // Posición (px = casilla * TILE, para alinear con el terreno)
      sprite.x = (npc.Position?.x ?? 0) * TILE
      sprite.y = (npc.Position?.y ?? 0) * TILE

      // Animación según acción y dirección
      const action = npc.ActionState?.action || 'idle'
      const facing = npc.ActionState?.facing || 'down'
      const moving = action.includes('moving')
      const anim = moving ? 'walk' : 'idle'
      this.spriteManager.setAnimation(sprite, anim, facing)

      // Tinte según emoción (más feliz = más vibrante)
      if (npc.Emotions) {
        const hap = (npc.Emotions.happiness ?? 50) / 100
        const r = Math.min(1, hap * 0.4 + 0.6)
        const g = Math.min(1, hap * 0.6 + 0.4)
        const b = Math.min(1, hap * 0.5 + 0.3)
        sprite.tint =
          (Math.floor(r * 255) << 16) |
          (Math.floor(g * 255) << 8) |
          Math.floor(b * 255)
      }

      // Efectos de partículas al cambiar de acción
      const prev = this.prevNPCStates.get(npc.id) || {}
      if (prev.action === 'socializing' && action !== 'socializing') {
        this.particles.emitHearts(sprite.x, sprite.y - 20)
      }
      if (action === 'buying_food' && prev.action !== 'buying_food') {
        this.particles.emitFood(sprite.x, sprite.y - 15)
      }
      if (action === 'working' && prev.action !== 'working') {
        this.particles.emitWork(sprite.x, sprite.y - 20)
      }
      this.prevNPCStates.set(npc.id, { action })

      // Indicadores de estado
      this.indicators.update(npc.id, {
        x: sprite.x,
        y: sprite.y - 30,
        hunger: npc.Needs?.hunger,
        energy: npc.Needs?.energy,
        sick: npc.Health?.is_sick,
        socializing: action === 'socializing'
      })

      // Reposicionar la etiqueta de nombre sobre la cabeza
      const label = this.npcLabels.get(npc.id)
      if (label) {
        label.x = sprite.x
        label.y = sprite.y - 34
      }
    })

    // Líneas de interacción social (NPCs charlando entre sí)
    this._drawSocialLinks(npcs)

    // Eliminar sprites/etiquetas huérfanos
    this.npcSprites.forEach((sprite, id) => {
      if (!currentNpcIds.has(id)) {
        sprite.removeFromParent()
        sprite.destroy()
        this.npcSprites.delete(id)
        this.indicators.remove(id)
        const label = this.npcLabels.get(id)
        if (label) {
          label.removeFromParent()
          label.destroy()
          this.npcLabels.delete(id)
        }
      }
    })
  }

  /**
   * Centra la cámara en el centroide de los NPCs la primera vez que hay datos,
   * para enmarcar la zona poblada sin depender de la posición aleatoria del mundo.
   * @private
   */
  _autoCenterCamera (worldState) {
    if (this._cameraCentered) return
    const npcs = worldState.getNPCs()
    if (npcs.length === 0) return
    let sx = 0; let sy = 0; let n = 0
    npcs.forEach(npc => {
      if (npc.Position) {
        sx += npc.Position.x
        sy += npc.Position.y
        n++
      }
    })
    if (n === 0) return
    this.camera.x = sx / n
    this.camera.y = sy / n
    this._cameraCentered = true
    this.updateTransform()
  }

  /**
   * Dibuja una línea entre cada NPC que está socializando y su interlocutor,
   * para que se vea que están interactuando entre sí.
   * @private
   */
  _drawSocialLinks (npcs) {
    const g = this.socialLinkGfx
    g.clear()
    npcs.forEach(npc => {
      if ((npc.ActionState?.action) !== 'socializing') return
      const targetId = npc.ActionState?.target_entity
      if (targetId == null) return
      const a = this.npcSprites.get(npc.id)
      const b = this.npcSprites.get(targetId)
      if (!a || !b) return
      g.lineStyle(1, 0xffee88, 0.7)
      g.moveTo(a.x, a.y - 12)
      g.lineTo(b.x, b.y - 12)
    })
  }

  /**
   * Actualiza la iluminación según la hora y el clima.
   * @private
   */
  _updateLighting (timeStr, weather) {
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number)
      let hour = h + (m ?? 0) / 60

      // Ajustar por clima
      if (weather === 'storm') {
        hour = Math.max(20, hour) // Más oscuro durante tormenta
      }

      this.lighting.update(hour)
    }
  }

  /**
   * Obtiene la variante de sprite según el nombre del NPC.
   * @private
   */
  _getSpriteVariant (npc) {
    const name = npc?.Identity?.name || ''
    if (name.length === 0) return 0
    return name.codePointAt(0) % 4
  }

  /**
   * Crea un gráfico para un edificio.
   * @private
   */
  _createBuildingGraphic (building, labelText) {
    const type = building?.Building?.building_type || 'house'
    const era = building?.Building?.era || 'classical'
    const p = eraPalette(era)
    const g = new PIXI.Graphics()

    // Sombra al pie (da sensación de volumen)
    g.beginFill(0x000000, 0.22)
    g.drawEllipse(0, 16, 15, 4)
    g.endFill()

    const drawers = {
      house: this._drawHouse, shop: this._drawShop, office: this._drawOffice, farm: this._drawFarm,
      hospital: this._drawHospital, school: this._drawSchool,
      totem: this._drawTotem, temple: this._drawTemple, market: this._drawMarket,
      granary: this._drawGranary, monument: this._drawMonument, bathhouse: this._drawBathhouse,
      church: this._drawChurch, mill: this._drawMill, blacksmith: this._drawBlacksmith,
      tavern: this._drawTavern, watchtower: this._drawWatchtower, library: this._drawLibrary,
      factory: this._drawFactory, warehouse: this._drawWarehouse, lab: this._drawLab,
      dome: this._drawDome, greenhouse: this._drawGreenhouse, spire: this._drawSpire
    }
    ;(drawers[type] || this._drawHouse).call(this, g, p)

    // Etiqueta con el nombre (localizada) bajo el edificio
    const text = new PIXI.Text((labelText || building?.Building?.name || type).substring(0, 16), {
      fontSize: 7, fill: 0xffffff, stroke: 0x000000, strokeThickness: 3, align: 'center', fontFamily: 'monospace'
    })
    text.anchor.set(0.5, 0)
    text.y = 20
    g.addChild(text)
    g.__labelText = text
    g.__building = building

    return g
  }

  // ---- Props decorativos (capa de decoración, no interactivos) ----
  _updateProps (worldState) {
    const props = worldState.getProps ? worldState.getProps() : []
    const ids = new Set(props.map(pr => pr.id))
    props.forEach(pr => {
      if (this.propGraphics.has(pr.id)) return
      const g = new PIXI.Graphics()
      g.eventMode = 'none'
      this._drawProp(g, pr.Prop?.prop_type || 'tree', pr.Prop?.variant || 0)
      g.x = (pr.Position?.x ?? 0) * TILE
      g.y = (pr.Position?.y ?? 0) * TILE
      this.decoLayer.addChild(g)
      this.propGraphics.set(pr.id, g)
    })
    this.propGraphics.forEach((g, id) => {
      if (!ids.has(id)) { g.removeFromParent(); g.destroy(); this.propGraphics.delete(id) }
    })
  }

  /** Etiqueta localizada de un edificio (usa el traductor inyectado por React). */
  _labelFor (b) {
    if (this._buildingLabel) {
      try { return this._buildingLabel(b) } catch { /* ignore */ }
    }
    return b?.Building?.name || b?.Building?.building_type || ''
  }

  /** Re-etiqueta todos los edificios (al cambiar de idioma). */
  relabelBuildings (labelFn) {
    if (labelFn) this._buildingLabel = labelFn
    this.buildingGraphics.forEach(g => {
      if (g.__labelText && g.__building) {
        g.__labelText.text = this._labelFor(g.__building)
      }
    })
  }

  /** Casa (estilo según época). @private */
  _drawHouse (g, p) {
    g.beginFill(p.wall); g.drawRect(-12, 0, 24, 16); g.endFill()
    g.beginFill(p.wall2); g.drawRect(6, -12, 4, 7); g.endFill() // chimenea
    g.beginFill(p.roof); g.drawPolygon([-15, 0, 0, -13, 15, 0]); g.endFill()
    g.beginFill(p.roof2); g.drawPolygon([-15, 0, 0, -13, -13, 0]); g.endFill()
    g.beginFill(p.door); g.drawRect(-3, 7, 7, 9); g.endFill()
    g.beginFill(p.accent); g.drawRect(2, 11, 1.3, 1.3); g.endFill()
    g.beginFill(p.glass); g.drawRect(-10, 4, 5, 5); g.drawRect(6, 4, 5, 5); g.endFill()
  }

  /** Tienda (estilo según época). @private */
  _drawShop (g, p) {
    g.beginFill(p.wall); g.drawRect(-13, -2, 26, 18); g.endFill()
    g.beginFill(p.accent); g.drawRect(-11, -8, 22, 5); g.endFill() // cartel
    for (let i = 0; i < 8; i++) { g.beginFill(i % 2 ? 0xffffff : p.roof); g.drawRect(-13 + i * 3.25, -3, 3.25, 4); g.endFill() }
    g.beginFill(p.glass); g.drawRect(-11, 3, 13, 9); g.endFill()
    g.beginFill(p.door); g.drawRect(4, 4, 8, 12); g.endFill()
  }

  /** Oficina (estilo según época). @private */
  _drawOffice (g, p) {
    g.beginFill(p.wall2); g.drawRect(-11, -18, 22, 34); g.endFill()
    g.beginFill(p.roof2); g.drawRect(-11, -20, 22, 3); g.endFill()
    g.beginFill(p.glass)
    for (let ry = -14; ry <= 8; ry += 6) { for (let rx = -8; rx <= 4; rx += 6) g.drawRect(rx, ry, 4, 4) }
    g.endFill()
    g.beginFill(p.door); g.drawRect(-4, 10, 8, 6); g.endFill()
  }

  /** Granja: granero + silo (color según época). @private */
  _drawFarm (g, p) {
    g.beginFill(0xc3cace); g.drawRect(9, -6, 8, 22); g.endFill() // silo
    g.beginFill(0x9aa2a8); g.drawPolygon([9, -6, 13, -11, 17, -6]); g.endFill()
    g.beginFill(0x8f989e); g.drawRect(9, -1, 8, 1); g.drawRect(9, 5, 8, 1); g.endFill()
    g.beginFill(p.roof); g.drawRect(-15, -2, 20, 18); g.endFill() // granero
    g.beginFill(p.roof2); g.drawPolygon([-16, -2, -12, -11, 2, -11, 6, -2]); g.endFill()
    g.beginFill(0xe8e4d8); g.drawRect(-8, 4, 10, 12); g.endFill() // puerta
    g.beginFill(p.roof); g.drawRect(-3.5, 4, 1, 12); g.drawRect(-8, 9, 10, 1); g.endFill()
  }

  /** Hospital: cuerpo blanco, banda roja, cruz y entrada. @private */
  _drawHospital (g) {
    g.beginFill(0xeef2f6); g.drawRect(-13, -4, 26, 20); g.endFill()
    g.beginFill(0xd23b3b); g.drawRect(-13, -8, 26, 4); g.endFill()
    g.beginFill(0xd23b3b); g.drawRect(-2, -1, 4, 9); g.drawRect(-5, 2, 10, 3); g.endFill()
    g.beginFill(0x9fdcf0); g.drawRect(-11, 2, 5, 5); g.drawRect(6, 2, 5, 5); g.endFill()
    g.beginFill(0x8fb8d8); g.drawRect(-4, 9, 8, 7); g.endFill()
  }

  /** Escuela: ladrillo con campanario. @private */
  _drawSchool (g) {
    g.beginFill(0xcf7a3c); g.drawRect(-14, -2, 28, 18); g.endFill()
    g.beginFill(0x7a3b1e); g.drawRect(-15, -5, 30, 4); g.endFill()
    g.beginFill(0xdf8a44); g.drawRect(-3, -15, 6, 11); g.endFill()
    g.beginFill(0x7a3b1e); g.drawPolygon([-5, -15, 0, -22, 5, -15]); g.endFill()
    g.beginFill(0xffcf5a); g.drawRect(-1.5, -12, 3, 3); g.endFill()
    g.beginFill(0x9fdcf0); g.drawRect(-11, 3, 5, 6); g.drawRect(6, 3, 5, 6); g.endFill()
    g.beginFill(0x5a3a1e); g.drawRect(-3, 8, 7, 8); g.endFill()
  }

  /** Prehistoria: tótem/poste tallado. @private */
  _drawTotem (g) {
    g.beginFill(0x7d7268); g.drawRect(-4, -18, 8, 34); g.endFill()
    g.beginFill(0x9a5a3a); g.drawRect(-6, -16, 12, 8); g.endFill()
    g.beginFill(0x5a8a5a); g.drawRect(-6, -4, 12, 8); g.endFill()
    g.beginFill(0xcf9f5a); g.drawPolygon([-8, -16, 0, -24, 8, -16]); g.endFill()
    g.beginFill(0x000000); g.drawRect(-3, -14, 2, 2); g.drawRect(1, -14, 2, 2); g.endFill()
  }

  /** Templo clásico: columnas y frontón. @private */
  _drawTemple (g, p) {
    g.beginFill(0xe8e2d2); g.drawRect(-16, 8, 32, 8); g.endFill()
    g.beginFill(0xf2ecdc); for (let cx = -13; cx <= 13; cx += 6.5) g.drawRect(cx - 1.5, -4, 3, 12); g.endFill()
    g.beginFill(0xd8d0be); g.drawRect(-16, -8, 32, 4); g.endFill()
    g.beginFill(p.accent); g.drawPolygon([-17, -8, 0, -17, 17, -8]); g.endFill()
  }

  /** Mercado: puestos con toldos. @private */
  _drawMarket (g) {
    g.beginFill(0x8a6a44); g.drawRect(-15, 6, 30, 4); g.endFill()
    const stall = (ox, c) => {
      g.beginFill(0x6b4a2a); g.drawRect(ox - 8, -2, 2, 10); g.drawRect(ox + 6, -2, 2, 10); g.endFill()
      for (let i = 0; i < 4; i++) { g.beginFill(i % 2 ? 0xffffff : c); g.drawRect(ox - 8 + i * 4, -6, 4, 4); g.endFill() }
      g.beginFill(0xcf9f5a); g.drawRect(ox - 6, 2, 12, 4); g.endFill()
    }
    stall(-8, 0xd23b3b); stall(8, 0x3a7ac0)
  }

  /** Granero circular con techo cónico. @private */
  _drawGranary (g, p) {
    g.beginFill(p.wall); g.drawRect(-9, -2, 18, 18); g.endFill()
    g.beginFill(p.wall2); g.drawEllipse(0, -2, 9, 3); g.endFill()
    g.beginFill(p.roof); g.drawPolygon([-11, -2, 0, -16, 11, -2]); g.endFill()
    g.beginFill(p.door); g.drawRect(-3, 8, 6, 8); g.endFill()
  }

  /** Monumento: obelisco sobre base. @private */
  _drawMonument (g, p) {
    g.beginFill(0xcfc6b0); g.drawRect(-8, 12, 16, 4); g.endFill()
    g.beginFill(0xe0d8c2); g.drawRect(-5, 6, 10, 6); g.endFill()
    g.beginFill(0xece5d2); g.drawRect(-3, -18, 6, 24); g.endFill()
    g.beginFill(p.accent); g.drawPolygon([-3, -18, 0, -24, 3, -18]); g.endFill()
  }

  /** Termas romanas con cúpula. @private */
  _drawBathhouse (g) {
    g.beginFill(0xe4ddca); g.drawRect(-14, -2, 28, 18); g.endFill()
    for (const ax of [-9, 0, 9]) { g.beginFill(0x7a9ab0); g.drawRect(ax - 3, 4, 6, 10); g.endFill() }
    g.beginFill(0xd8d0be); g.drawRect(-14, -4, 28, 3); g.endFill()
    g.beginFill(0xb7c6cf); g.drawEllipse(0, -3, 10, 7); g.endFill()
    g.beginFill(0xcf7a3c); g.drawRect(-1, -12, 2, 3); g.endFill()
  }

  /** Iglesia: nave, torre con aguja y cruz. @private */
  _drawChurch (g) {
    g.beginFill(0xc7bfa8); g.drawRect(-13, -2, 22, 18); g.endFill()
    g.beginFill(0xb3ab94); g.drawRect(9, -14, 8, 30); g.endFill()
    g.beginFill(0x8a4a34); g.drawPolygon([8, -14, 13, -24, 18, -14]); g.endFill()
    g.beginFill(0xffcf5a); g.drawRect(12, -31, 2, 8); g.drawRect(10, -28, 6, 2); g.endFill()
    g.beginFill(0x8a4a34); g.drawPolygon([-14, -2, -2, -12, 10, -2]); g.endFill()
    g.beginFill(0x6b4626); g.drawRect(-6, 6, 8, 10); g.endFill()
    g.beginFill(0x9fc6e0); g.drawCircle(-2, 0, 3); g.endFill()
  }

  /** Molino de viento. @private */
  _drawMill (g, p) {
    g.beginFill(p.wall); g.drawRect(-9, -2, 18, 18); g.endFill()
    g.beginFill(p.roof); g.drawPolygon([-10, -2, 0, -14, 10, -2]); g.endFill()
    g.beginFill(p.door); g.drawRect(-3, 8, 6, 8); g.endFill()
    g.beginFill(0xe8e4d8)
    g.drawPolygon([0, -8, -2, -20, 2, -20]); g.drawPolygon([0, -8, -12, -10, -12, -6])
    g.drawPolygon([0, -8, 2, 4, -2, 4]); g.drawPolygon([0, -8, 12, -6, 12, -10])
    g.endFill()
    g.beginFill(0x5a4a3a); g.drawCircle(0, -8, 2); g.endFill()
  }

  /** Herrería: fragua encendida, chimenea y yunque. @private */
  _drawBlacksmith (g) {
    g.beginFill(0x8a7a6a); g.drawRect(-13, -2, 24, 18); g.endFill()
    g.beginFill(0x5a5048); g.drawRect(-14, -5, 26, 4); g.endFill()
    g.beginFill(0x6b6058); g.drawRect(7, -16, 5, 12); g.endFill()
    g.beginFill(0xff8a3c); g.drawRect(-9, 4, 8, 8); g.endFill()
    g.beginFill(0xffd24a); g.drawRect(-7, 6, 4, 4); g.endFill()
    g.beginFill(0x3a3a42); g.drawRect(2, 8, 8, 3); g.drawRect(4, 11, 4, 3); g.endFill()
  }

  /** Taberna: entramado de madera y cartel colgante. @private */
  _drawTavern (g) {
    g.beginFill(0xcaa06a); g.drawRect(-13, -2, 26, 18); g.endFill()
    g.beginFill(0x6b4a2a); g.drawRect(-13, -2, 26, 2); g.drawRect(-13, 6, 26, 1.5); g.drawRect(-1, -2, 2, 18); g.endFill()
    g.beginFill(0x8a4a34); g.drawPolygon([-15, -2, 0, -12, 15, -2]); g.endFill()
    g.beginFill(0x6b4626); g.drawRect(-4, 7, 8, 9); g.endFill()
    g.beginFill(0x4a3222); g.drawRect(9, -2, 6, 1.5); g.endFill()
    g.beginFill(0x2f2a24); g.drawRect(12, -1, 5, 6); g.endFill()
    g.beginFill(0xd8a24a); g.drawRect(13, 0, 3, 4); g.endFill()
  }

  /** Torre de vigilancia con almenas. @private */
  _drawWatchtower (g) {
    g.beginFill(0x9a9086); g.drawRect(-7, -20, 14, 36); g.endFill()
    g.beginFill(0x7d746a); g.drawRect(-7, -20, 14, 3); g.endFill()
    g.beginFill(0x9a9086); for (let bx = -7; bx < 7; bx += 4) g.drawRect(bx, -24, 2.5, 4); g.endFill()
    g.beginFill(0x2f2a24); g.drawRect(-2, -14, 4, 5); g.drawRect(-2, -4, 4, 5); g.endFill()
    g.beginFill(0x5a3a1e); g.drawRect(-3, 9, 6, 7); g.endFill()
    g.beginFill(0xd23b3b); g.drawPolygon([0, -24, 0, -30, 7, -27]); g.endFill()
  }

  /** Biblioteca: columnas y frontón. @private */
  _drawLibrary (g, p) {
    g.beginFill(0xd8cfb8); g.drawRect(-15, -4, 30, 20); g.endFill()
    g.beginFill(0xece5d0); for (let cx = -11; cx <= 11; cx += 5.5) g.drawRect(cx - 1.5, -2, 3, 14); g.endFill()
    g.beginFill(0xbfae86); g.drawRect(-16, -8, 32, 4); g.endFill()
    g.beginFill(p.accent); g.drawPolygon([-17, -8, 0, -16, 17, -8]); g.endFill()
    g.beginFill(0x6b4626); g.drawRect(-4, 8, 8, 8); g.endFill()
  }

  /** Fábrica: ladrillo, chimeneas humeantes y techo dentado. @private */
  _drawFactory (g) {
    g.beginFill(0x8a4a3a); g.drawRect(-15, 0, 30, 16); g.endFill()
    g.beginFill(0x5a4038); g.drawRect(6, -18, 5, 18); g.drawRect(12, -14, 4, 14); g.endFill()
    g.beginFill(0x9a9088); g.drawRect(6, -19, 5, 2); g.endFill()
    g.beginFill(0x556070); for (let sx = -15; sx < 4; sx += 6) g.drawPolygon([sx, 0, sx, -5, sx + 6, 0]); g.endFill()
    g.beginFill(0x2f3a44); g.drawRect(-12, 6, 6, 10); g.endFill()
    g.beginFill(0xbfc6cc); g.drawRect(-4, 4, 4, 4); g.drawRect(1, 4, 4, 4); g.endFill()
    g.beginFill(0xffffff, 0.4); g.drawCircle(8, -20, 3); g.drawCircle(11, -24, 2.5); g.endFill()
  }

  /** Almacén: nave grande con portón. @private */
  _drawWarehouse (g) {
    g.beginFill(0x9aa0a6); g.drawRect(-16, 0, 32, 16); g.endFill()
    g.beginFill(0x6f7982); g.drawRect(-17, -4, 34, 5); g.endFill()
    g.beginFill(0x5a636b); g.drawRect(-8, 4, 16, 12); g.endFill()
    g.beginFill(0x8a929a); for (let dx = -7; dx < 8; dx += 3) g.drawRect(dx, 4, 1.5, 12); g.endFill()
  }

  /** Laboratorio high-tech con antena. @private */
  _drawLab (g, p) {
    g.beginFill(p.wall2); g.drawRect(-13, -6, 26, 22); g.endFill()
    g.beginFill(p.roof2); g.drawRect(-13, -8, 26, 3); g.endFill()
    g.beginFill(p.accent); g.drawRect(-10, -2, 7, 5); g.drawRect(1, -2, 7, 5); g.drawRect(-10, 6, 7, 5); g.drawRect(1, 6, 7, 5); g.endFill()
    g.beginFill(0x2f3a52); g.drawRect(-3, 10, 6, 6); g.endFill()
    g.beginFill(0x9aa0a6); g.drawRect(-1, -16, 2, 8); g.endFill()
    g.beginFill(p.accent); g.drawCircle(0, -16, 2); g.endFill()
  }

  /** Cúpula/hábitat futurista. @private */
  _drawDome (g) {
    g.beginFill(0x4a5876); g.drawRect(-13, 8, 26, 8); g.endFill()
    g.beginFill(0x8fdceb, 0.88); g.drawEllipse(0, 4, 14, 12); g.endFill()
    g.lineStyle(1, 0x5a6b8a, 0.6)
    g.moveTo(-14, 4); g.lineTo(14, 4); g.moveTo(0, -8); g.lineTo(0, 16)
    g.lineStyle(0)
    g.beginFill(0xffffff, 0.25); g.drawEllipse(-4, 0, 3, 5); g.endFill()
  }

  /** Invernadero de cristal con plantas. @private */
  _drawGreenhouse (g) {
    g.beginFill(0xbfe6d6, 0.85); g.drawRect(-13, -2, 26, 18); g.endFill()
    g.beginFill(0xbfe6d6, 0.85); g.drawPolygon([-14, -2, 0, -12, 14, -2]); g.endFill()
    g.lineStyle(1, 0x7fae9a, 0.7)
    for (let vx = -9; vx <= 9; vx += 6) { g.moveTo(vx, -2); g.lineTo(vx, 16) }
    g.moveTo(-13, 6); g.lineTo(13, 6)
    g.lineStyle(0)
    g.beginFill(0x4a9a4a); g.drawRect(-10, 10, 3, 5); g.drawRect(-2, 9, 3, 6); g.drawRect(6, 10, 3, 5); g.endFill()
  }

  /** Aguja/rascacielos futurista. @private */
  _drawSpire (g, p) {
    g.beginFill(p.wall2); g.drawPolygon([-6, 16, -3, -22, 3, -22, 6, 16]); g.endFill()
    g.beginFill(p.accent); g.drawPolygon([-3, -22, 0, -30, 3, -22]); g.endFill()
    g.beginFill(0xffffff, 0.5); g.drawRect(-1, -18, 2, 30); g.endFill()
    g.beginFill(p.accent); g.drawCircle(0, -30, 2); g.endFill()
  }

  /** Dibuja un prop decorativo. @private */
  _drawProp (g, type, v) {
    g.beginFill(0x000000, 0.18); g.drawEllipse(0, 6, 6, 2); g.endFill()
    switch (type) {
      case 'tree':
        g.beginFill(0x6b4a2a); g.drawRect(-1.5, 0, 3, 7); g.endFill()
        g.beginFill([0x3f8c3a, 0x357a30, 0x4a9a44][v % 3]); g.drawCircle(0, -3, 7); g.drawCircle(-4, 0, 5); g.drawCircle(4, 0, 5); g.endFill()
        break
      case 'bush':
        g.beginFill([0x3f8c3a, 0x4a9a44, 0x357a30][v % 3]); g.drawCircle(-2, 2, 4); g.drawCircle(2, 1, 4); g.drawCircle(0, 3, 4); g.endFill()
        break
      case 'campfire':
        g.beginFill(0x5a4030); g.drawRect(-5, 4, 10, 2); g.endFill()
        g.beginFill(0x6b4a2a); g.drawRect(-4, 3, 3, 3); g.drawRect(2, 3, 3, 3); g.endFill()
        g.beginFill(0xff7a2a); g.drawPolygon([-3, 4, 0, -4, 3, 4]); g.endFill()
        g.beginFill(0xffd24a); g.drawPolygon([-1.5, 4, 0, -1, 1.5, 4]); g.endFill()
        break
      case 'totem_small':
        g.beginFill(0x7d7268); g.drawRect(-2, -6, 4, 12); g.endFill()
        g.beginFill(0x9a5a3a); g.drawRect(-3, -6, 6, 4); g.endFill()
        g.beginFill(0x5a8a5a); g.drawRect(-3, 0, 6, 4); g.endFill()
        break
      case 'well':
        g.beginFill(0x8a8078); g.drawRect(-5, 0, 10, 7); g.endFill()
        g.beginFill(0x2a3a44); g.drawEllipse(0, 0, 5, 2.5); g.endFill()
        g.beginFill(0x6b4a2a); g.drawRect(-6, -8, 1.5, 8); g.drawRect(4.5, -8, 1.5, 8); g.endFill()
        g.beginFill(0x8a4a34); g.drawPolygon([-7, -8, 0, -12, 7, -8]); g.endFill()
        break
      case 'fountain':
        g.beginFill(0xb7c0c6); g.drawEllipse(0, 4, 8, 4); g.endFill()
        g.beginFill(0x6fb0d8); g.drawEllipse(0, 4, 6, 2.6); g.endFill()
        g.beginFill(0xb7c0c6); g.drawRect(-1.5, -4, 3, 6); g.endFill()
        g.beginFill(0x9fdcf0); g.drawCircle(0, -4, 2); g.endFill()
        break
      case 'statue':
        g.beginFill(0xcfc6b0); g.drawRect(-4, 4, 8, 3); g.endFill()
        g.beginFill(0xe0d8c4); g.drawRect(-2, -6, 4, 10); g.drawCircle(0, -7, 2.4); g.endFill()
        break
      case 'lamppost':
        g.beginFill(0x3a3a42); g.drawRect(-1, -10, 2, 16); g.endFill()
        g.beginFill(0xffd85a, 0.25); g.drawCircle(0, -11, 5); g.endFill()
        g.beginFill(0xffd85a); g.drawCircle(0, -11, 2.4); g.endFill()
        break
      case 'barrel':
        g.beginFill(0x8a5a2a); g.drawRect(-3, -2, 6, 8); g.endFill()
        g.beginFill(0x5a3a1a); g.drawRect(-3, 0, 6, 1); g.drawRect(-3, 3, 6, 1); g.endFill()
        break
      case 'bench':
        g.beginFill(0x6b4a2a); g.drawRect(-5, 0, 10, 2); g.drawRect(-5, 2, 1.5, 3); g.drawRect(3.5, 2, 1.5, 3); g.endFill()
        break
      case 'stall':
        g.beginFill(0x6b4a2a); g.drawRect(-6, -1, 12, 6); g.endFill()
        for (let i = 0; i < 4; i++) { g.beginFill(i % 2 ? 0xffffff : 0xd23b3b); g.drawRect(-6 + i * 3, -5, 3, 4); g.endFill() }
        break
      case 'antenna':
        g.beginFill(0x9aa0a6); g.drawRect(-1, -12, 2, 18); g.endFill()
        g.lineStyle(1, 0x9aa0a6, 0.8); g.moveTo(0, -6); g.lineTo(-5, -2); g.moveTo(0, -6); g.lineTo(5, -2); g.lineStyle(0)
        g.beginFill(0x7fe0d8); g.drawCircle(0, -12, 2); g.endFill()
        break
      case 'solar':
        g.beginFill(0x2a3a5a); g.drawPolygon([-6, 0, 6, -2, 6, 3, -6, 5]); g.endFill()
        g.beginFill(0x4a7ac0); g.drawRect(-5, -1, 4, 3); g.drawRect(0, -1.5, 4, 3); g.endFill()
        g.beginFill(0x555555); g.drawRect(-0.5, 3, 1, 4); g.endFill()
        break
      case 'planter':
        g.beginFill(0x6f86a6); g.drawRect(-5, 2, 10, 4); g.endFill()
        g.beginFill(0x4a9a4a); g.drawCircle(-2, 1, 2.5); g.drawCircle(2, 0, 2.5); g.endFill()
        break
      default:
        g.beginFill(0x4a9a44); g.drawCircle(0, 0, 4); g.endFill()
    }
  }

  /**
   * Obtiene la posición actual de la cámara.
   */
  getCamera () {
    return { ...this.camera }
  }

  /**
   * Redimensiona el canvas al tamaño del contenedor.
   */
  resize () {
    const parent = this.app.view.parentElement
    if (parent) {
      this.app.renderer.resize(parent.clientWidth, parent.clientHeight)
      this.lighting.resize(this.app.screen.width, this.app.screen.height)
      this._notifyCamera() // el viewport visible cambió
    }
  }

  /**
   * Destruye la escena y libera recursos.
   */
  destroy () {
    this._camListener = null
    // Remover event listeners
    const view = this.app.view
    view.removeEventListener('mousedown', this._onMouseDown)
    globalThis.removeEventListener('mouseup', this._onMouseUp)
    globalThis.removeEventListener('mousemove', this._onMouseMove)
    view.removeEventListener('wheel', this._onWheel)
    view.removeEventListener('touchstart', this._onTouchStart)
    globalThis.removeEventListener('touchend', this._onTouchEnd)
    globalThis.removeEventListener('touchmove', this._onTouchMove)

    // Destruir contenedores
    this.npcSprites.forEach(sprite => sprite.destroy())
    this.npcLabels.forEach(label => label.destroy())
    this.buildingGraphics.forEach(graphic => graphic.destroy())
    this.propGraphics.forEach(graphic => graphic.destroy())
    this.npcSprites.clear()
    this.npcLabels.clear()
    this.buildingGraphics.clear()
    this.propGraphics.clear()
    this.prevNPCStates.clear()

    // Destruir la aplicación Pixi
    this.app.destroy(true, { children: true, texture: true })
  }
}
