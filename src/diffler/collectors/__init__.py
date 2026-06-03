"""Lazy data collectors for GitHub profile statistics.

This package ports the stats-action collection logic into diffler with
on-demand execution: only data points referenced by templates are fetched.
"""

from diffler.collectors.base import Collector, CollectorContext
from diffler.collectors.registry import CollectorRegistry

__all__ = ["Collector", "CollectorContext", "CollectorRegistry"]
