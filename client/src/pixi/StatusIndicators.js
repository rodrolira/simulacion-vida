// src/pixi/StatusIndicators.js
import * as PIXI from 'pixi.js'

export class StatusIndicators {
  constructor (parent) {
    this.parent = parent
    this.indicators = new Map() // entityId -> { container, icons }
  }

  update (id, data) {
    let ind = this.indicators.get(id)
    if (!ind) {
      ind = { container: new PIXI.Container(), icons: {} }
      this.parent.addChild(ind.container)
      this.indicators.set(id, ind)
    }

    ind.container.x = data.x
    ind.container.y = data.y
    ind.container.removeChildren()

    const icons = []

    // Icono de hambre
    if (data.hunger < 30) {
      icons.push(this.createIcon('🍽️', 0xff4444))
    }

    // Icono de sueño
    if (data.energy < 25) {
      icons.push(this.createIcon('💤', 0x8888ff))
    }

    // Icono de enfermedad
    if (data.sick) {
      icons.push(this.createIcon('🤒', 0x88ff44))
    }

    // Icono de socialización
    if (data.socializing) {
      icons.push(this.createIcon('💬', 0xffffff))
    }

    icons.forEach((icon, index) => {
      icon.x = index * 14
      ind.container.addChild(icon)
    })
  }

  createIcon (emoji, color) {
    const text = new PIXI.Text(emoji, {
      fontSize: 10,
      fill: color,
      align: 'center'
    })
    text.anchor.set(0.5, 1)
    return text
  }

  remove (id) {
    const ind = this.indicators.get(id)
    if (ind) {
      // PIXI v7 no tiene DisplayObject.remove(); hay que quitarlo del padre y destruirlo.
      ind.container.removeFromParent()
      ind.container.destroy({ children: true })
      this.indicators.delete(id)
    }
  }
}
