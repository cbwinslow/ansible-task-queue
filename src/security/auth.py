"""
Authentication and Authorization for Task Queue System
"""
import hashlib
import hmac
import jwt
import time
from typing import Optional, List
from ..core.config import settings

class AuthManager:
    """Handles user authentication and authorization"""
    
    def __init__(self):
        self.secret_key = settings.security.secret_key
        self.allowed_users = settings.security.allowed_users
        self.require_auth = settings.security.require_authentication
    
    def authenticate_user(self, username: str, password: str) -> bool:
        """Authenticate a user (placeholder - implement your auth logic)"""
        # In a real system, you would check against a user database
        # This is a simplified example
        if not self.require_auth:
            return True
        
        return username in self.allowed_users
    
    def generate_token(self, username: str) -> str:
        """Generate JWT token for authenticated user"""
        payload = {
            'user': username,
            'exp': int(time.time()) + (settings.security.jwt_expire_minutes * 60)
        }
        return jwt.encode(payload, self.secret_key, algorithm=settings.security.jwt_algorithm)
    
    def verify_token(self, token: str) -> Optional[str]:
        """Verify JWT token and return username"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[settings.security.jwt_algorithm])
            return payload.get('user')
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def is_user_allowed(self, username: str) -> bool:
        """Check if user is allowed to submit tasks"""
        if not self.require_auth:
            return True
        return username in self.allowed_users
    
    def hash_password(self, password: str) -> str:
        """Hash password for storage"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return hmac.compare_digest(self.hash_password(password), hashed_password)