import os
import json
from urllib import request, parse, error


class SupabaseDB:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        if not self.url or not self.key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY environment variables must be set"
            )
        # Ensure base URL ends without trailing slash
        self.rest_url = self.url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, params: dict | None = None, data: dict | None = None):
        url = self.rest_url + path
        if params:
            query = parse.urlencode(params)
            url += f"?{query}"
        data_bytes = None
        if data is not None:
            data_bytes = json.dumps(data).encode()
        req = request.Request(url, method=method, headers=self.headers, data=data_bytes)
        try:
            with request.urlopen(req) as resp:
                resp_data = resp.read().decode()
                if resp_data:
                    return json.loads(resp_data)
                return None
        except error.HTTPError as exc:
            msg = exc.read().decode()
            raise RuntimeError(f"Supabase request failed: {exc.code} {msg}") from None

    # User operations
    def create_user(self, username: str, hashed_password: str, status: str = "Pending"):
        data = {"username": username, "hashed_password": hashed_password, "status": status}
        res = self._request("POST", "/users", data=data)
        return res[0] if res else None

    def get_user_by_username(self, username: str):
        params = {"username": f"eq.{username}"}
        res = self._request("GET", "/users", params=params)
        return res[0] if res else None

    def get_user(self, user_id: int):
        params = {"id": f"eq.{user_id}"}
        res = self._request("GET", "/users", params=params)
        return res[0] if res else None

    def get_users(self):
        return self._request("GET", "/users", params={})

    def update_user_status(self, user_id: int, status: str):
        params = {"id": f"eq.{user_id}"}
        data = {"status": status}
        res = self._request("PATCH", "/users", params=params, data=data)
        return res[0] if res else None

    # Trade operations
    def create_trade(self, trade: dict):
        res = self._request("POST", "/trades", data=trade)
        return res[0] if res else None

    def get_trade(self, trade_id: int):
        params = {"id": f"eq.{trade_id}"}
        res = self._request("GET", "/trades", params=params)
        return res[0] if res else None

    def get_trades(self, owner_id: int, skip: int = 0, limit: int = 100):
        params = {
            "owner_id": f"eq.{owner_id}",
            "offset": skip,
            "limit": limit,
        }
        return self._request("GET", "/trades", params=params)

    def update_trade(self, trade_id: int, trade: dict):
        params = {"id": f"eq.{trade_id}"}
        res = self._request("PATCH", "/trades", params=params, data=trade)
        return res[0] if res else None

    def delete_trade(self, trade_id: int):
        params = {"id": f"eq.{trade_id}"}
        res = self._request("DELETE", "/trades", params=params)
        return res


db = SupabaseDB()
