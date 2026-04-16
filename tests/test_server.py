"""
test_server.py — Unit tests for TCP server event system.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import unittest
import threading
import time
import json
import socket

from server.server import SimServer
from client.client import SimClient


class TestServerClient(unittest.TestCase):
    """Integration tests for the server–client event system."""

    @classmethod
    def setUpClass(cls):
        """Start server on a test port."""
        cls.port = 19876
        cls.server = SimServer(host="127.0.0.1", port=cls.port)
        cls.server_thread = threading.Thread(target=cls.server.start, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)  # Wait for server to bind

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()

    def _make_client(self) -> SimClient:
        client = SimClient(host="127.0.0.1", port=self.port)
        connected = client.connect()
        self.assertTrue(connected, "Client failed to connect")
        return client

    def _send_raw(self, msg: dict) -> dict:
        """Send a raw JSON command and read the response."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        sock.connect(("127.0.0.1", self.port))
        raw = json.dumps(msg) + "\n"
        sock.sendall(raw.encode())
        data = sock.recv(4096).decode()
        sock.close()
        return json.loads(data.strip())

    def test_add_event(self):
        resp = self._send_raw({"cmd": "add", "event": "test_event_1"})
        self.assertEqual(resp["status"], "ok")
        self.assertEqual(resp["cmd"], "add")

    def test_add_duplicate(self):
        self._send_raw({"cmd": "add", "event": "dup_event"})
        resp = self._send_raw({"cmd": "add", "event": "dup_event"})
        self.assertEqual(resp["status"], "exists")

    def test_remove_event(self):
        self._send_raw({"cmd": "add", "event": "remove_me"})
        resp = self._send_raw({"cmd": "remove", "event": "remove_me"})
        self.assertEqual(resp["status"], "ok")

    def test_remove_nonexistent(self):
        resp = self._send_raw({"cmd": "remove", "event": "no_such_event"})
        self.assertEqual(resp["status"], "not_found")

    def test_trigger_event(self):
        self._send_raw({"cmd": "add", "event": "trigger_test"})
        resp = self._send_raw({
            "cmd": "trigger", "event": "trigger_test",
            "data": {"key": "value"},
        })
        self.assertEqual(resp["status"], "ok")

    def test_list_events(self):
        self._send_raw({"cmd": "add", "event": "list_test_event"})
        resp = self._send_raw({"cmd": "list"})
        self.assertEqual(resp["status"], "ok")
        self.assertIn("list_test_event", resp["events"])

    def test_exit_command(self):
        resp = self._send_raw({"cmd": "exit"})
        self.assertEqual(resp["status"], "ok")

    def test_unknown_command(self):
        resp = self._send_raw({"cmd": "foobar"})
        self.assertEqual(resp["status"], "error")

    def test_client_subscribe_and_broadcast(self):
        """Test that a subscribed client receives broadcast messages."""
        client = self._make_client()
        received = []

        def on_broadcast(event, data):
            received.append((event, data))

        client.set_broadcast_handler(on_broadcast)

        # Subscribe
        client.send_command("subscribe", event="broadcast_test")
        time.sleep(0.3)

        # Trigger from another connection
        self._send_raw({"cmd": "trigger", "event": "broadcast_test", "data": {"msg": "hello"}})
        time.sleep(0.5)

        client.disconnect()

        self.assertGreaterEqual(len(received), 1)
        self.assertEqual(received[0][0], "broadcast_test")
        self.assertEqual(received[0][1]["msg"], "hello")


if __name__ == "__main__":
    unittest.main()
