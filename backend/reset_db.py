import asyncio
import os
from database import engine
from models import Base
import seed

async def reset_and_seed():
    print("🗑️ Dropping all existing tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    print("✅ Tables dropped. Starting seed script...")
    await seed.seed()

if __name__ == "__main__":
    asyncio.run(reset_and_seed())
