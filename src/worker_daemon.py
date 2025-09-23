#!/usr/bin/env python3
"""
Task Queue Worker Daemon
"""
import sys
import logging
import signal
from src.workers.queue_worker import worker
from src.core.database import db_manager
from src.core.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.worker.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"{settings.log_directory}/worker.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("task_queue_worker")

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, shutting down...")
    worker.stop()
    db_manager.disconnect()
    sys.exit(0)

def main():
    """Main worker entry point"""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("Starting Task Queue Worker")
    logger.info(f"Worker settings: max_concurrent={settings.worker.max_concurrent_tasks}, "
               f"poll_interval={settings.worker.poll_interval_seconds}s")
    
    try:
        # Start the worker
        worker.start()
    except Exception as e:
        logger.error(f"Worker failed with error: {e}")
        sys.exit(1)
    finally:
        db_manager.disconnect()

if __name__ == "__main__":
    main()