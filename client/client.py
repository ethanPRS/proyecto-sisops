"""
client.py — TCP Event Client with PyQt signal bridge.

Connects to the SimServer, sends commands, and listens for
broadcast notifications in a background thread.  Exposes a
Qt-signal-compatible interface so the GUI can react to server pushes.
"""

import json
import socket
import threading
import logging
from typing import Optional, Callable, Dict, Any

from client.client_config import HOST, PORT, BUFFER_SIZE, ENCODING

logger = logging.getLogger(__name__)


class SimClient:
    """
    TCP client for the OS simulator event system.

    Quick start:
        client = SimClient()
        client.connect()
        client.send_command("add", event="scheduling_done")
        client.send_command("subscribe", event="scheduling_done")
        client.send_command("trigger", event="scheduling_done", data={...})
        client.disconnect()
    """

    def __init__(self, host: str = HOST, port: int = PORT):
        self.host = host
        self.port = port
        self._socket: Optional[socket.socket] = None
        self._listener_thread: Optional[threading.Thread] = None
        self._running = False
        self._on_broadcast: Optional[Callable[[str, dict], None]] = None
        self._on_response: Optional[Callable[[dict], None]] = None
        self._lock = threading.Lock()

    # ── Connection lifecycle ─────────────────────────────────────────

    @property
    def is_connected(self) -> bool:
        return self._socket is not None and self._running

    def connect(self) -> bool:
        """
        Connect to the server.

        Returns True on success.
        """
        try:
            self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._socket.settimeout(5.0)
            self._socket.connect((self.host, self.port))
            self._socket.settimeout(None)
            self._running = True

            # Start background listener
            self._listener_thread = threading.Thread(
                target=self._listen, daemon=True
            )
            self._listener_thread.start()
            logger.info("Connected to server %s:%d", self.host, self.port)
            return True
        except (ConnectionRefusedError, OSError) as e:
            logger.error("Connection failed: %s", e)
            self._socket = None
            return False

    def disconnect(self):
        """Send exit command and close the connection."""
        if self._socket:
            try:
                self.send_command("exit")
            except OSError:
                pass
            self._running = False
            try:
                self._socket.close()
            except OSError:
                pass
            self._socket = None
            logger.info("Disconnected from server.")

    # ── Sending ──────────────────────────────────────────────────────

    def send_command(self, cmd: str, **kwargs) -> bool:
        """
        Send a JSON command to the server.

        Args:
            cmd:    Command name (add, remove, trigger, subscribe, etc.)
            **kwargs: Additional fields (event, data, etc.)

        Returns True if sent successfully.
        """
        if not self._socket:
            logger.warning("Not connected.")
            return False

        msg = {"cmd": cmd}
        msg.update(kwargs)
        raw = json.dumps(msg) + "\n"

        with self._lock:
            try:
                self._socket.sendall(raw.encode(ENCODING))
                return True
            except (BrokenPipeError, ConnectionResetError, OSError) as e:
                logger.error("Send failed: %s", e)
                self._running = False
                return False

    # ── Callbacks ────────────────────────────────────────────────────

    def set_broadcast_handler(self, handler: Callable[[str, dict], None]):
        """Set callback for incoming broadcast messages: handler(event_name, data)."""
        self._on_broadcast = handler

    def set_response_handler(self, handler: Callable[[dict], None]):
        """Set callback for command responses: handler(response_dict)."""
        self._on_response = handler

    # ── Background listener ──────────────────────────────────────────

    def _listen(self):
        """Listen for incoming messages from the server."""
        buffer = ""
        while self._running and self._socket:
            try:
                data = self._socket.recv(BUFFER_SIZE)
                if not data:
                    break
                buffer += data.decode(ENCODING)

                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        msg = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if msg.get("type") == "broadcast":
                        if self._on_broadcast:
                            self._on_broadcast(
                                msg.get("event", ""),
                                msg.get("data", {}),
                            )
                    else:
                        if self._on_response:
                            self._on_response(msg)

            except (ConnectionResetError, BrokenPipeError, OSError):
                break

        self._running = False
