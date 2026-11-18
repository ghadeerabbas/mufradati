# خادم نطق مزيّف محلي: يقرّر الردّ من المفتاح المرسل (لا شبكة)
import http.server,sys
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_POST(self):
        k=self.headers.get("Ocp-Apim-Subscription-Key","");self.rfile.read(int(self.headers.get("Content-Length",0)))
        code,body={"good":(200,b"\xff"*5000),"tiny":(200,b"x"),"bad":(401,b""),"off":(403,b""),"busy":(429,b"")}.get(k,(500,b""))
        open(sys.argv[2],"a").write(k+"|"+self.headers.get("Content-Type","")+"\n")
        self.send_response(code);self.end_headers();self.wfile.write(body)
http.server.HTTPServer(("127.0.0.1",int(sys.argv[1])),H).serve_forever()
