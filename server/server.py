"""
server.py — TCP Event Server.

Listens for client connections and processes JSON commands:
  - add     <event>          Create a new event channel
  - remove  <event>          Delete an event channel
  - trigger <event> [data]   Fire event and broadcast to subscribers
  - subscribe <event>        Subscribe this client to an event
  - unsubscribe <event>      Unsubscribe this client from an event
  - list                     List all registered events
  - exit                     Disconnect gracefully

Protocol:  newline-delimited JSON over TCP.
"""

import json
import socket
import threading
import logging
from typing import Optional

from server.event_manager import EventManager
from server.subscription import SubscriptionManager

logger = logging.getLogger(__name__)


class SimServer:
    """
    Threaded TCP server for the OS simulator's event system.

    Designed to run in a daemon thread alongside the PyQt5 GUI.
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 9999):
        self.host = host
        self.port = port
        self.event_manager = EventManager()
        self.sub_manager = SubscriptionManager()
        self._server_socket: Optional[socket.socket] = None
        self._running = False
        self._clients: list = []
        self._lock = threading.Lock()

    # ── Lifecycle ────────────────────────────────────────────────────

    def start(self):
        """Start listening for connections in the current thread."""
        self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._server_socket.settimeout(1.0)  # Allow periodic shutdown checks
        self._server_socket.bind((self.host, self.port))
        self._server_socket.listen(5)
        self._running = True
        logger.info("Server listening on %s:%d", self.host, self.port)

        while self._running:
            try:
                client_sock, addr = self._server_socket.accept()
                logger.info("Client connected: %s", addr)
                with self._lock:
                    self._clients.append(client_sock)
                t = threading.Thread(
                    target=self._handle_client,
                    args=(client_sock, addr),
                    daemon=True,
                )
                t.start()
            except socket.timeout:
                continue
            except OSError:
                break

    def stop(self):
        """Shut down the server and close all client connections."""
        self._running = False
        with self._lock:
            for c in self._clients:
                try:
                    c.close()
                except OSError:
                    pass
            self._clients.clear()
        if self._server_socket:
            try:
                self._server_socket.close()
            except OSError:
                pass
        logger.info("Server stopped.")

    # ── Client handler ───────────────────────────────────────────────

    def _handle_client(self, client_sock: socket.socket, addr):
        """Process commands from a single client connection."""
        buffer = ""
        try:
            while self._running:
                data = client_sock.recv(4096)
                if not data:
                    break
                buffer += data.decode("utf-8")

                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    self._process_message(client_sock, line)

        except (ConnectionResetError, BrokenPipeError, OSError):
            pass
        finally:
            self.sub_manager.unsubscribe_all(client_sock)
            with self._lock:
                if client_sock in self._clients:
                    self._clients.remove(client_sock)
            try:
                client_sock.close()
            except OSError:
                pass
            logger.info("Client disconnected: %s", addr)

    def _process_message(self, client_sock: socket.socket, raw: str):
        """Parse and execute one JSON command."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            self._reply(client_sock, {"status": "error", "message": "Invalid JSON"})
            return

        cmd = msg.get("cmd", "").lower()

        if cmd == "add":
            event = msg.get("event", "")
            ok = self.event_manager.add_event(event)
            self._reply(client_sock, {
                "status": "ok" if ok else "exists",
                "cmd": "add",
                "event": event,
            })

        elif cmd == "remove":
            event = msg.get("event", "")
            ok = self.event_manager.remove_event(event)
            self._reply(client_sock, {
                "status": "ok" if ok else "not_found",
                "cmd": "remove",
                "event": event,
            })

        elif cmd == "trigger":
            event = msg.get("event", "")
            data = msg.get("data", {})
            ok = self.event_manager.trigger_event(event, data)
            if ok:
                self.sub_manager.broadcast(event, data)
            self._reply(client_sock, {
                "status": "ok" if ok else "not_found",
                "cmd": "trigger",
                "event": event,
            })

        elif cmd == "subscribe":
            event = msg.get("event", "")
            if not self.event_manager.has_event(event):
                # Auto-create event for convenience
                self.event_manager.add_event(event)
            self.sub_manager.subscribe(client_sock, event)
            self._reply(client_sock, {
                "status": "ok",
                "cmd": "subscribe",
                "event": event,
            })

        elif cmd == "unsubscribe":
            event = msg.get("event", "")
            self.sub_manager.unsubscribe(client_sock, event)
            self._reply(client_sock, {
                "status": "ok",
                "cmd": "unsubscribe",
                "event": event,
            })

        elif cmd == "list":
            events = self.event_manager.list_events()
            self._reply(client_sock, {
                "status": "ok",
                "cmd": "list",
                "events": events,
            })

        elif cmd == "exit":
            self._reply(client_sock, {"status": "ok", "cmd": "exit"})
            self.sub_manager.unsubscribe_all(client_sock)
            client_sock.close()

        else:
            self._reply(client_sock, {
                "status": "error",
                "message": f"Unknown command: '{cmd}'",
            })

    @staticmethod
    def _reply(client_sock: socket.socket, data: dict):
        """Send a JSON response to the client."""
        try:
            msg = json.dumps(data) + "\n"
            client_sock.sendall(msg.encode("utf-8"))
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
