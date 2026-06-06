# app/processing/parsers/__init__.py
from .passport import PassportParser
from .id_card import IDCardParser

__all__ = ["PassportParser", "IDCardParser"]
