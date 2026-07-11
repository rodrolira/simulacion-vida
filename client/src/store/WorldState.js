class WorldState {
  constructor () {
    this.entities = new Map() // id -> { components }
    this.listeners = []
  }

  update (data) {
    if (data.full) {
      this.entities.clear()
      data.entities.forEach(e => this.entities.set(e.id, e.components))
    } else {
      if (data.changed) {
        Object.entries(data.changed).forEach(([id, comps]) => {
          this.entities.set(parseInt(id), comps)
        })
      }
      if (data.removed) {
        data.removed.forEach(id => this.entities.delete(id))
      }
    }
    this.listeners.forEach(fn => fn())
  }

  onChange (fn) {
    this.listeners.push(fn)
  }

  getAll () {
    return Array.from(this.entities.entries()).map(([id, comps]) => ({
      id,
      ...comps
    }))
  }

  getNPCs () {
    return this.getAll().filter(e => e.Identity && e.Position)
  }

  getBuildings () {
    return this.getAll().filter(e => e.Building && e.Position)
  }

  getProps () {
    return this.getAll().filter(e => e.Prop && e.Position)
  }
}

export const worldState = new WorldState()
