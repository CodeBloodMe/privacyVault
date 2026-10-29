"""
PrivacyVault — Vercel Serverless Entry Point
Wraps the FastAPI app for deployment on Vercel.
"""
import sys
import os

# Add project root to path so `backend` package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.app.main import app
