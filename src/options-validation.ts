export function assertHTMLElement(value: unknown, context: string, name: string): asserts value is HTMLElement {
  if (typeof HTMLElement === 'undefined' || !(value instanceof HTMLElement)) {
    throw new TypeError(`${context} ${name} must be an HTMLElement.`);
  }
}

export function assertOptionalTextArea(
  value: unknown,
  context: string,
  name: string
): asserts value is HTMLTextAreaElement | undefined {
  if (
    value !== undefined &&
    (typeof HTMLTextAreaElement === 'undefined' || !(value instanceof HTMLTextAreaElement))
  ) {
    throw new TypeError(`${context} ${name} must be an HTMLTextAreaElement.`);
  }
}

export function assertString(value: unknown, context: string, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${context} ${name} must be a string.`);
  }
}

export function assertOptionalString(value: unknown, context: string, name: string): asserts value is string | undefined {
  if (value !== undefined) {
    assertString(value, context, name);
  }
}

export function assertBoolean(value: unknown, context: string, name: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${context} ${name} must be a boolean.`);
  }
}

export function assertOptionalBoolean(value: unknown, context: string, name: string): asserts value is boolean | undefined {
  if (value !== undefined) {
    assertBoolean(value, context, name);
  }
}

export function assertOptionalFunction(value: unknown, context: string, name: string): asserts value is Function | undefined {
  if (value !== undefined && typeof value !== 'function') {
    throw new TypeError(`${context} ${name} must be a function.`);
  }
}

export function assertOptionalStringArray(
  value: unknown,
  context: string,
  name: string
): asserts value is readonly string[] | undefined {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TypeError(`${context} ${name} must be an array of strings.`);
  }
}
