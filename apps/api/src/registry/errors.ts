export class ExtendableError extends Error {
  constructor(message: string) {
    super();
    this.message = message;
    this.stack = new Error().stack;
    this.name = this.constructor.name;
  }
}

export class RegistryError extends ExtendableError {
  private code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }

  toJSON() {
    return { 'errors:': [{ code: this.code, message: this.message }] };
  }
}
