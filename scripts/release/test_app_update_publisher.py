import base64
import hashlib
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
import publish_app_update as publisher

URL='https://github.com/Acelith/Chronexus/releases/download/v0.4.0/latest.json'

def fake_github(calls,assets=None,releases=None,fail_verify=None):
    """A minimal GitHub release API: one draft release with id 100."""
    state={'draft':True,'assets':[] if assets is None else assets,'next':200}
    class Fake:
        def __init__(self,authorization):pass
        def api(self,path,method='GET',body=None):
            calls.append((method,path))
            if path==publisher.API:return {'full_name':'Acelith/Chronexus','private':False,'permissions':{'push':True}}
            if '/tags/' in path:raise urllib.error.HTTPError('https://github.com',404,'absent',{},None)
            if path.endswith('/releases?per_page=100'):return [{'id':100,'tag_name':'v0.4.0'}] if releases is None else releases
            if method=='POST':return {'id':100,'tag_name':'v0.4.0','draft':True}
            if method=='PATCH':state['draft']=False;return {'id':100,'tag_name':'v0.4.0','draft':False}
            if path.endswith('/assets'):return list(state['assets'])
            if path.endswith('/releases/100'):return {'id':100,'tag_name':'v0.4.0','draft':state['draft']}
            raise AssertionError('Unexpected request '+method+' '+path)
        def asset_api_url(self,asset):return publisher.BASE+publisher.API+f"/releases/assets/{asset}"
        def upload(self,release,path):
            state['next']+=1
            asset={'id':state['next'],'name':path.name,'size':4,'browser_download_url':URL}
            state['assets'].append(asset)
            return asset
        def verify(self,url,expected,anonymous=False):
            if fail_verify and fail_verify(anonymous):raise ValueError('Remote checksum mismatch')
    return Fake

class PublisherTests(unittest.TestCase):
    def package(self,folder):
        root=Path(folder);package=root/'installers'/'release';package.mkdir(parents=True)
        notes=root/'docs/releases';notes.mkdir(parents=True);(notes/'v0.4.0.md').write_text('Public notes')
        report={'version':'0.4.0','sourceCommit':'synthetic','assets':[{'name':'latest.json','size':4,'sha256':'a'*64}]}
        return root,package,report

    def run_publish(self,root,package,report,fake,finalize=True):
        with patch.object(publisher,'ROOT',root),patch.object(publisher,'validate',return_value=(package,report)),patch.object(publisher,'verify_signature'),patch.object(publisher,'Client',fake),patch.object(publisher.urllib.request,'build_opener',side_effect=AssertionError('no public network in tests')):
            return publisher.publish('token synthetic-secret',package,finalize)

    def test_download_paths_are_fixed_to_release_assets_on_github(self):
        self.assertEqual(publisher.allowed_download(URL),URL)
        self.assertEqual(publisher.allowed_download('https://github.com/Acelith/Chronexus/releases/download/v0.4.0/latest.json').split('/')[-1],'latest.json')
        for url in ['https://foreign.example/attachments/abc','http://github.com/attachments/abc','https://github.com/api/v1/user','https://github.com/attachments/abc?token=secret','https://github.com/Acelith/Chronexus/releases/download/../../config']:
            with self.assertRaises(ValueError):publisher.allowed_download(url)

    def test_github_cli_credentials_stay_in_memory_and_select_the_github_host(self):
        class Result:
            returncode=0
            stdout='synthetic-test-token\n'
        with patch('github_release.subprocess.run',return_value=Result()) as run:
            self.assertEqual(publisher.authorized_git_header(),'Bearer synthetic-test-token')
            self.assertEqual(run.call_args.args[0],['gh','auth','token','--hostname','github.com'])
        Result.stdout=''
        with patch('github_release.subprocess.run',return_value=Result()):
            with self.assertRaises(ValueError):publisher.authorized_git_header()

    def test_remote_content_must_match_size_and_hash(self):
        client=publisher.Client('token synthetic')
        expected={'size':4,'sha256':hashlib.sha256(b'test').hexdigest()}
        for payload in [b'bad',b'test!',b'fake']:
            with patch.object(client.opener,'open',return_value=io.BytesIO(payload)):
                with self.assertRaises(ValueError):client.verify(URL,expected)
        with patch.object(client.opener,'open',return_value=io.BytesIO(b'test')) as opened:
            client.verify(URL,expected,anonymous=True)
            self.assertNotIn('Authorization',opened.call_args.args[0].headers)

    def test_corrupt_draft_asset_never_finalizes_and_receipt_keeps_no_secret(self):
        with tempfile.TemporaryDirectory() as folder:
            root,package,report=self.package(folder);calls=[]
            with self.assertRaises(ValueError):self.run_publish(root,package,report,fake_github(calls,fail_verify=lambda anonymous:True))
            self.assertFalse(any(method=='PATCH' for method,_ in calls))
            content=(package/'github-update-receipt.json').read_text()
            self.assertNotIn('synthetic-secret',content)
            self.assertEqual(json.loads(content)['releaseId'],100)
            self.assertFalse((package/'.publish.lock').exists())

    def test_an_asset_attached_by_another_publisher_stops_before_uploading(self):
        with tempfile.TemporaryDirectory() as folder:
            root,package,report=self.package(folder);calls=[]
            foreign=[{'id':999,'name':'latest.json','size':4,'browser_download_url':URL}]
            with self.assertRaises(ValueError) as error:self.run_publish(root,package,report,fake_github(calls,assets=foreign))
            self.assertIn('another publisher',str(error.exception))
            self.assertFalse(any(method=='PATCH' for method,_ in calls))

    def test_two_drafts_for_the_same_tag_are_never_made_public(self):
        with tempfile.TemporaryDirectory() as folder:
            root,package,report=self.package(folder);calls=[]
            twins=[{'id':100,'tag_name':'v0.4.0'},{'id':101,'tag_name':'v0.4.0'}]
            with self.assertRaises(ValueError) as error:self.run_publish(root,package,report,fake_github(calls,releases=twins))
            self.assertIn('More than one release',str(error.exception))
            self.assertFalse(any(method=='PATCH' for method,_ in calls))

    def test_a_failed_public_check_says_the_release_is_public_and_can_be_resumed(self):
        with tempfile.TemporaryDirectory() as folder:
            root,package,report=self.package(folder);calls=[]
            fake=fake_github(calls,fail_verify=lambda anonymous:anonymous)
            with self.assertRaises(publisher.PublicationError) as error:self.run_publish(root,package,report,fake)
            self.assertIn('PUBLIC',str(error.exception))
            receipt=json.loads((package/'github-update-receipt.json').read_text())
            self.assertEqual(receipt['state'],'public-unverified')
            self.assertNotIn('published',receipt)
            # Resuming retries only the verification: no second PATCH, nothing deleted.
            fake.verify=lambda self,url,expected,anonymous=False:None
            with patch.object(publisher.urllib.request,'build_opener') as opener:
                opener.return_value.open.return_value=io.BytesIO(json.dumps({'id':100,'draft':False,'prerelease':False}).encode())
                with patch.object(publisher,'ROOT',root),patch.object(publisher,'validate',return_value=(package,report)),patch.object(publisher,'verify_signature'),patch.object(publisher,'Client',fake):
                    receipt=publisher.publish('token synthetic-secret',package,True)
            self.assertEqual(receipt['state'],'published')
            self.assertEqual(sum(method=='PATCH' for method,_ in calls),1)
            self.assertFalse(any(method=='DELETE' for method,_ in calls))

    def test_a_running_publication_locks_the_package(self):
        with tempfile.TemporaryDirectory() as folder:
            root,package,report=self.package(folder);calls=[]
            (package/'.publish.lock').write_text('1234')
            with self.assertRaises(ValueError) as error:self.run_publish(root,package,report,fake_github(calls))
            self.assertIn('.publish.lock',str(error.exception))
            self.assertEqual(calls,[])

    def test_the_production_key_signature_test_is_mandatory(self):
        with tempfile.TemporaryDirectory() as folder:
            package=Path(folder)
            data=b'synthetic'
            (package/'Chronexus_0.4.0_x64-setup.exe').write_bytes(data)
            report={'assets':[{'name':'Chronexus_0.4.0_x64-setup.exe','sha256':hashlib.sha256(data).hexdigest()}]}
            class Failed:
                returncode=101
                stdout='test result: FAILED. 0 passed; 1 failed'
            with patch.object(publisher.subprocess,'run',return_value=Failed()) as run:
                with self.assertRaises(ValueError):publisher.verify_signature(package,report)
                env=run.call_args.kwargs['env']
                self.assertEqual(env['CHRONEXUS_QA_UPDATE_PACKAGE'],str(package/'Chronexus_0.4.0_x64-setup.exe'))
                self.assertIn('updates_signed_release_package_matches_production_key',run.call_args.args[0])
            class Passed:
                returncode=0
                stdout='test result: ok. 1 passed; 0 failed'
            with patch.object(publisher.subprocess,'run',return_value=Passed()):
                publisher.verify_signature(package,report)
                (package/'Chronexus_0.4.0_x64-setup.exe').write_bytes(b'changed')
                with self.assertRaises(ValueError):publisher.verify_signature(package,report)

if __name__=='__main__':unittest.main()
