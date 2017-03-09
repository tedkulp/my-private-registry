module.exports = (function() {

  class ExtendableError extends Error {
    constructor(message) {
      super();
      this.message = message;
      this.stack = (new Error()).stack;
      this.name = this.constructor.name;
    }
  }

  class RegistryError extends ExtendableError {
    constructor(code, message) {
      super(message);
      this.code = code;
    }

    toJSON() {
      return {"errors:": [
        {code: this.code,
         message: this.message}
      ]};
    }
  }

  return {
    RegistryError: RegistryError
  };
})();
