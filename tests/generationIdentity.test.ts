import { describe, it, expect, afterEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { generationIdentity, IDENTITY_COOKIE, signedIdentity } from '../api/_lib/generationIdentity';
afterEach(()=>vi.unstubAllEnvs());
describe('anonymous browser generation identity',()=>{
  it('keeps a browser stable without exposing its identifier to client JS',()=>{
    vi.stubEnv('GENERATION_IDENTITY_SECRET','test-only-secret');
    const headers:Record<string,string>={};
    const request={headers:{host:'example.test'}} as IncomingMessage;
    const response={setHeader:(key:string,value:string)=>{headers[key]=value;}} as unknown as ServerResponse;
    const first=generationIdentity(request,response);
    expect(first).toMatch(/^[a-f0-9]{64}$/); expect(headers['Set-Cookie']).toContain('HttpOnly; SameSite=Strict'); expect(headers['Set-Cookie']).toContain('; Secure');
    const cookie=headers['Set-Cookie'].split(';')[0];
    expect(generationIdentity({headers:{cookie}} as IncomingMessage)).toBe(first);
    expect(generationIdentity({headers:{cookie:cookie.replace(/.$/,'x')}} as IncomingMessage)).toBeNull();
  });
  it('requires a valid signed UUID for POST; another browser has a distinct identity',()=>{
    vi.stubEnv('GENERATION_IDENTITY_SECRET','test-only-secret');
    const one=signedIdentity('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), two=signedIdentity('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const identity=(value:string)=>generationIdentity({headers:{cookie:`${IDENTITY_COOKIE}=${value}`}} as IncomingMessage);
    expect(identity(one)).not.toBe(identity(two)); expect(identity(`${one}.extra`)).toBeNull();
    expect(generationIdentity({headers:{}} as IncomingMessage)).toBeNull();
  });
});
