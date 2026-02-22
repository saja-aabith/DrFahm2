from flask import jsonify


def error_response(code: str, message: str, http_status: int, details: dict = None):
    """
    Global error envelope. ALL error responses must go through this function.

    Shape:
    {
        "error": {
            "code":    "stable_enum_string",
            "message": "human readable",
            "details": {}
        }
    }
    """
    body = {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        }
    }
    return jsonify(body), http_status


# ── Convenience helpers ────────────────────────────────────────────────────────

def bad_request(code: str, message: str, details: dict = None):
    return error_response(code, message, 400, details)


def unauthorized(message: str = "Authentication required."):
    return error_response("unauthenticated", message, 401)


def forbidden(code: str = "forbidden", message: str = "Access denied.", details: dict = None):
    return error_response(code, message, 403, details)


def conflict(message: str, details: dict = None):
    return error_response("optimistic_lock_conflict", message, 409, details)


def not_implemented_response(message: str = "Not yet configured."):
    return error_response("not_implemented", message, 501)


# ── Flask error handler registration ─────────────────────────────────────────

def register_error_handlers(app):
    @app.errorhandler(400)
    def handle_400(e):
        return error_response("bad_request", str(e), 400)

    @app.errorhandler(401)
    def handle_401(e):
        return error_response("unauthenticated", str(e), 401)

    @app.errorhandler(403)
    def handle_403(e):
        return error_response("forbidden", str(e), 403)

    @app.errorhandler(404)
    def handle_404(e):
        return error_response("not_found", "The requested resource does not exist.", 404)

    @app.errorhandler(405)
    def handle_405(e):
        return error_response("method_not_allowed", str(e), 405)

    @app.errorhandler(500)
    def handle_500(e):
        return error_response("internal_error", "An unexpected error occurred.", 500)