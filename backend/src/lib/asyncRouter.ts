import { Router, RequestHandler } from "express";

/**
 * Express 4 does not catch rejections from `async` route handlers. A throw
 * inside one leaves the request hanging with no response at all — which in the
 * browser surfaces as an opaque CORS/network failure rather than the real
 * error. This wraps every handler so async throws reach the global error
 * handler and come back as a proper JSON 500.
 *
 * Use in place of `Router()` in route modules.
 */
export function asyncRouter(): Router {
  const router = Router();
  const methods = ["get", "post", "put", "patch", "delete"] as const;

  for (const method of methods) {
    const original = router[method].bind(router);
    (router as unknown as Record<string, unknown>)[method] = (
      path: string,
      ...handlers: RequestHandler[]
    ) => original(path, ...handlers.map(wrap));
  }

  return router;
}

function wrap(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next) as unknown;
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        (result as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}
