// src/pixi/LightingSystem.js
import * as PIXI from 'pixi.js'

export class LightingSystem {
  constructor (parent, width, height) {
    this.overlay = new PIXI.Graphics()
    parent.addChild(this.overlay)
    this.width = width
    this.height = height
    this.currentAlpha = 0
  }

  update (hour) {
    // Calcular oscuridad según hora
    let darkness
    if (hour >= 6 && hour < 8)
      darkness = 1 - (hour - 6) / 2 // amanecer 6-8h → 1 a 0
    else if (hour >= 8 && hour < 18) darkness = 0 // día 8-18h → 0
    else if (hour >= 18 && hour < 20)
      darkness = (hour - 18) / 2 // atardecer 18-20h → 0 a 1
    else if (hour >= 20 || hour < 5) darkness = 1 // noche 20-5h → 1
    else darkness = 1 - (hour - 5) / 1 // pre-amanecer 5-6h → 1 a 1

    darkness = Math.max(0, Math.min(1, darkness))

    // Interpolar suavemente
    this.currentAlpha += (darkness - this.currentAlpha) * 0.05
    const alpha = this.currentAlpha * 0.55 // máximo 55% oscuridad

    // Dibujar overlay
    this.overlay.clear()
    this.overlay.beginFill(0x0a0a2e, alpha) // azul oscuro noche
    this.overlay.drawRect(-10000, -10000, 20000, 20000)
    this.overlay.endFill()

    // Luz puntual en el centro (linterna/jugador) - opcional
    // Efecto de farolas en edificios (opcional)
  }

  resize (w, h) {
    this.width = w
    this.height = h
  }
}
