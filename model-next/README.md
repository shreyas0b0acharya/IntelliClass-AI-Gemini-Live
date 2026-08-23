downladoed nova.glb from the https://vtubeme.com/free-vrm-avatars/nova
placded in the C:\AMyFiles\Projects\collegeProjects\FinalYearProject\lipsync\public\models\nova.glb

i installed this package permanently as i check to conevert with many models :
pnpm add -D gltfjsx

if u dont want u can use the pnpm dlx or npx for installation

pnpm gltfjsx public/models/nova.glb -o src/components/Avatar.jsx -r public

`gltfjsx` is used to **convert a `.glb/.gltf` 3D model into a React component**.

### In short:

```text
nova.glb
   ↓
gltfjsx
   ↓
Avatar.jsx
   ↓
React Three Fiber
   ↓
3D Avatar in your React app
```

It helps you:

* 🧩 **Import GLB models easily** into React
* 🎨 Access **meshes and materials**
* 🦴 Access **bones/rigs**
* 🎬 Access **animations**
* 👄 Access **morph targets** for facial/lip-sync animation
* ⚛️ Control the model using normal React/JS/TS code

**It does NOT create animations or lip-sync.** It only converts the model into React-friendly code.




install HeadTTS form  git clone https://github.com/met4citizen/HeadTTS.git

pnpm start -- --trace 255 to check the current status of that
2. Check whether the model was cached

Run:

Get-ChildItem "$env:USERPROFILE\.cache\huggingface\hub" -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -gt 100MB } |
  Select-Object FullName, Length

Also check the Transformers cache inside HeadTTS:

Get-ChildItem ".\node_modules\@huggingface\transformers\.cache" -Recurse -ErrorAction SilentlyContinue |
  Select-Object FullName, Length

The repository provides several versions of the model. The standard FP32 model is ~326 MB, while the FP16 version is ~163 MB and q8f16 is ~86 MB.


    "dtype": "fp16", insted of   "dtype": "fp32",in C:\AMyFiles\Projects\collegeProjects\FinalYearProject\HeadTTS\headtts-node.json



    
PS C:\AMyFiles\Projects\collegeProjects\FinalYearProject> curl.exe -X POST http://localhost:8882/v1/synthesize `
>>   -H "Content-Type: application/json" `
>>   -d '{"input":"Hello students, welcome to the classroom.","voice":"af_bella","language":"en-us","speed":1,"audioEncoding":"wav"}' `
>>   -o headtts-response.json
  % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
                                 Dload  Upload  Total   Spent   Left   Speed
100 207.1k 100 207.0k 100    123 283.6k    168                              0
PS C:\AMyFiles\Projects\collegeProjects\FinalYearProject> Get-Content .\headtts-response.json -Raw | ConvertFrom-Json | Select-Object visemes, vtimes, vdurations, phonemes

visemes         vtimes                vdurations         phonemes
-------         ------                ----------         --------
{E, RR, O, SS…} {489, 541, 590, 769…} {72, 69, 147, 70…} {ə, l, O, s…}
