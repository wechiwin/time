from flask import jsonify


def make_response(data=None, code=0, message="ok"):
    return jsonify({
        "code": code,
        "message": message,
        "data": data
    })


class Response:
    @staticmethod
    def success(data=None, message="ok"):
        return make_response(data=data, code=0, message=message)

    @staticmethod
    def error(code=1, message="error"):
        return make_response(data=None, code=code, message=message)
