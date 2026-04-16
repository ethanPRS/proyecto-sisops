"""
event_manager.py — Event management for the TCP server.

Manages named events: add, remove, trigger.  When an event is
triggered, all registered callbacks are invoked with the event data.
"""

import threading
from typing import Callable, Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)


class EventManager:
    """
    Manages a registry of named events and their callbacks.

    Thread-safe: all operations are protected by a lock.
    """

    def __init__(self):
        self._events: Dict[str, List[Callable]] = {}
        self._lock = threading.Lock()

    def add_event(self, event_name: str) -> bool:
        """
        Register a new event type.

        Returns True if the event was created, False if it already exists.
        """
        with self._lock:
            if event_name in self._events:
                logger.warning("Event '%s' already exists.", event_name)
                return False
            self._events[event_name] = []
            logger.info("Event '%s' created.", event_name)
            return True

    def remove_event(self, event_name: str) -> bool:
        """
        Remove an event type and all its callbacks.

        Returns True if removed, False if not found.
        """
        with self._lock:
            if event_name not in self._events:
                logger.warning("Event '%s' not found.", event_name)
                return False
            del self._events[event_name]
            logger.info("Event '%s' removed.", event_name)
            return True

    def trigger_event(self, event_name: str, data: Any = None) -> bool:
        """
        Trigger an event, calling all registered callbacks.

        Returns True if the event existed and was triggered.
        """
        with self._lock:
            if event_name not in self._events:
                logger.warning("Cannot trigger unknown event '%s'.", event_name)
                return False
            callbacks = list(self._events[event_name])

        # Call outside lock to avoid deadlock
        for cb in callbacks:
            try:
                cb(event_name, data)
            except Exception as e:
                logger.error("Callback error on event '%s': %s", event_name, e)
        return True

    def register_callback(self, event_name: str, callback: Callable) -> bool:
        """Attach a callback to an existing event."""
        with self._lock:
            if event_name not in self._events:
                return False
            self._events[event_name].append(callback)
            return True

    def list_events(self) -> List[str]:
        """Return all registered event names."""
        with self._lock:
            return list(self._events.keys())

    def has_event(self, event_name: str) -> bool:
        with self._lock:
            return event_name in self._events
