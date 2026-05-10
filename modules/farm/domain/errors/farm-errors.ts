export class FarmAlreadyExists extends Error {
  constructor(name: string) {
    super(`Granja con nombre "${name}" ya existe`);
    this.name = "FarmAlreadyExists";
  }
}

export class FarmNotFound extends Error {
  constructor(id: string) {
    super(`Granja ${id} no encontrada`);
    this.name = "FarmNotFound";
  }
}
