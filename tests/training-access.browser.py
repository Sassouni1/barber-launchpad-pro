import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT='http://localhost:8080'
Path('/tmp/browser/training-audit').mkdir(parents=True, exist_ok=True)
async def restore(page):
 await page.goto(ROOT)
 await page.evaluate('([k,v])=>localStorage.setItem(k,v)',[os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'],os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON']])
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  for width,height in [(1280,1800),(390,844)]:
   c=await b.new_context(viewport={'width':width,'height':height},is_mobile=width==390,has_touch=width==390)
   page=await c.new_page();errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   await restore(page)
   # Real signed-in content; no simulated responses.
   lesson=ROOT+'/courses/hair-system/lesson/62f0a33c-c95c-4453-a34d-c825a4dfb6a0'
   await page.goto(lesson,wait_until='networkidle')
   assert page.url==lesson
   frames=page.locator('iframe[src*="vimeo"]')
   assert await frames.count()>0
   await frames.first.evaluate('(el)=>el.dataset.accessCheck="preserved"')
   await page.evaluate('async()=>{const {supabase}=await import("/src/integrations/supabase/client.ts"); const {data:{session}}=await supabase.auth.getSession(); await supabase.auth._notifyAllSubscribers("TOKEN_REFRESHED",session); return Boolean(session);}')
   await page.wait_for_timeout(2000)
   print('AFTER REFRESH URL',page.url,'HEADINGS',await page.get_by_role('heading').all_text_contents(),'ERRORS',errors)
   await page.screenshot(path='/tmp/browser/training-audit/refresh-state.png')
   assert await frames.first.get_attribute('data-access-check')=='preserved','Refresh remounted video'
   await page.screenshot(path=f'/tmp/browser/training-audit/real-lesson-{width}.png')
   print('REAL LESSON AND REFRESH',width,'passed')
   await c.close()
   for certified,listed in [(False,False),(False,True),(True,False),(True,True)]:
    c=await b.new_context(viewport={'width':width,'height':height},is_mobile=width==390,has_touch=width==390)
    page=await c.new_page();await restore(page)
    cert={'id':'00000000-0000-4000-8000-000000000001','certificate_name':'Regression Check','certificate_url':None,'issued_at':'2026-10-01T00:00:00Z'} if certified else None
    await page.route('**/rest/v1/certifications?*',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps(cert)))
    await page.route('**/rest/v1/specialist_directory?*',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'id':'existing','status':'approved'} if listed else None)))
    await page.goto(ROOT+'/courses/hair-system',wait_until='networkidle')
    await page.locator('button:visible').filter(has=page.get_by_role('heading',name='Hair System Training',exact=True)).click()
    await page.wait_for_timeout(500)
    assert await page.get_by_role('dialog').count()==0
    print('OPEN HEADINGS',await page.get_by_role('heading').all_text_contents()); assert await page.locator('button:visible').filter(has_text='How to Make a Template').count()>0
    if certified and not listed:
     await page.screenshot(path=f'/tmp/browser/training-audit/certified-no-listing-{width}.png')
    print('TRAINING OPEN',width,'certified',certified,'listing',listed)
    await c.close()
  # Simulated outage, but real signed-in identity; confirm retry recovers real lessons.
  c=await b.new_context(viewport={'width':1280,'height':1800});page=await c.new_page();await restore(page)
  await page.route('**/rest/v1/courses?*',lambda r:r.fulfill(status=503,content_type='application/json',body='{"message":"Temporary unavailable"}'))
  await page.goto(ROOT+'/courses/hair-system/lesson/62f0a33c-c95c-4453-a34d-c825a4dfb6a0')
  await page.get_by_role('heading',name='Training couldn’t load').wait_for(timeout=20000)
  await page.screenshot(path='/tmp/browser/training-audit/load-error.png')
  await page.unroute('**/rest/v1/courses?*')
  await page.get_by_role('button',name='Try Again',exact=True).click()
  await page.locator('iframe[src*="vimeo"]').first.wait_for(timeout=15000)
  print('FAILED COURSE LOAD RETRY recovered real video')
  await c.close();await b.close()
asyncio.run(main())
