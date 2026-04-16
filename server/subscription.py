"""
subscription.py — Pub/Sub Subscription Manager.

Clients subscribe to event channels.  When an event is triggered, the
SubscriptionManager broadcasts the data to all subscribed clients.
"""

import threading
import json
import socket
import logging
from typing import Dict, Set, Optional

logger = logging.getLogger(__name__)


class SubscriptionManager:
    """
    Manages client subscriptions to named event channels.

    Each client is identified by its socket object.  When an event
    fires, all subscribed client sockets receive the notification.
    """

    def __init__(self):
        # event_name → set of client sockets
        self._subscriptions: Dict[str, Set[socket.socket]] = {}
        self._lock = threading.Lock()

    def subscribe(self, client: socket.socket, event_name: str) -> bool:
        """
        Subscribe a client to an event channel.

        Returns True on success.
        """
        with self._lock:
            if event_name not in self._subscriptions:
                self._subscriptions[event_name] = set()
            self._subscriptions[event_name].add(client)
            logger.info("Client subscribed to '%s'.", event_name)
            return True

    def unsubscribe(self, client: socket.socket, event_name: str) -> bool:
        """Unsubscribe a client from an event channel."""
        with self._lock:
            subs = self._subscriptions.get(event_name)
            if subs and client in subs:
                subs.discard(client)
                logger.info("Client unsubscribed from '%s'.", event_name)
                return True
            return False

    def unsubscribe_all(self, client: socket.socket):
        """Remove a client from all subscriptions (on disconnect)."""
        with self._lock:
            for subs in self._subscriptions.values():
                subs.discard(client)

    def broadcast(self, event_name: str, data: dict):
        """
        Send data to all clients subscribed to `event_name`.

        Clients that fail to receive are silently removed.
        """
        with self._lock:
            subs = self._subscriptions.get(event_name, set()).copy()

        failed = []
        message = json.dumps({
            "type": "broadcast",
            "event": event_name,
            "data": data,
        }) + "\n"
        encoded = message.encode("utf-8")

        for client_sock in subs:
            try:
                client_sock.sendall(encoded)
            except (BrokenPipeError, ConnectionResetError, OSError):
                logger.warning("Failed to send to client, removing subscription.")
                failed.append(client_sock)

        # Clean up failed clients
        if failed:
            with self._lock:
                subs_set = self._subscriptions.get(event_name, set())
                for f in failed:
                    subs_set.discard(f)

    def get_subscribers(self, event_name: str) -> int:
        """Return the number of subscribers for an event."""
        with self._lock:
            return len(self._subscriptions.get(event_name, set()))
