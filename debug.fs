precision mediump float;

varying vec3 vNormal;
varying vec4 vPos;
varying vec2 vTexCoordinate;
varying vec4 vLightPos;
varying mat4 vView;

uniform sampler2D depthTexture;

struct Materia{
	sampler2D diffuse;
	sampler2D specular;
	float shininess;
};

struct Light{
	vec3 ambient;
	vec3 specular;
	vec3 position;
	vec3 color;
};

uniform Materia materia;

#define LIGHT_COUNT 3

uniform Light lights[LIGHT_COUNT];
vec3 calcDotLight(Light light,Materia materia,vec3 pos,vec3 normal,vec2 tex);

void main(){
	vec2 TEXEL=vec2(1./512.,1./512.);
	
	vec3 pos=vPos.xyz/vPos.w;
	
	vec3 normal=normalize(vNormal);
	
	vec3 lightRes=vec3(0);
	for(int i=0;i<LIGHT_COUNT;i++){
		Light light=lights[i];
		light.position=(vView*vec4(light.position,1)).xyz/light.position.w;
		lightRes+=calcDotLight(light,materia,pos,normal,vTexCoordinate);
	}
	
	vec3 lightCoordinatePos=vLightPos.xyz/vLightPos.w;
	bool inRange=lightCoordinatePos.x>=.0&&
	lightCoordinatePos.x<=1.&&
	lightCoordinatePos.y>=.0&&
	lightCoordinatePos.y<=1.;
	
	//float bias=.0005*tan(acos(dot(normalize(lightDirReverse),normal)));
	float bias=.0005;
	
	float curDepth=lightCoordinatePos.z-bias;
	float texDepth=texture2D(depthTexture,lightCoordinatePos.xy).r;
	float shadow=inRange&&curDepth>texDepth?.2:1.;
	
	vec4 offsetX=vec4(-1.,1.,-1.,1.);
	vec4 offsetY=vec4(-1.,1.,1.,-1.);
	for(int i=0;i<4;i++){
		vec2 samplerPos=lightCoordinatePos.xy+(vec2(offsetX[i],offsetY[i])*TEXEL);
		float texDepth=texture2D(depthTexture,samplerPos).r;
		shadow+=inRange&&curDepth>texDepth?.2:1.;
	}
	
	shadow/=4.;
	
	gl_FragColor=vec4(lightRes,1);
	gl_FragColor.xyz*=lightRes*shadow;
}

vec3 calcDotLight(Light light,Materia materia,vec3 pos,vec3 normal,vec2 tex){
	//考虑光强度衰减
	float distance=length(light.position.xyz-pos);
	float attenuation=1./(1.+.09*distance+.032*(distance*distance));
	vec3 lightDirReverse=pos-light.position;
	
	//漫反射光
	float diffuse=max(dot(normalize(lightDirReverse),normal),.0);
	vec3 ambient=texture2D(materia.diffuse,tex).xyz*diffuse;
	
	//镜面光
	vec3 viewDir=normalize(vec3(0,0,-1)-pos);
	vec3 halfVector=normalize(viewDir+lightDirReverse);
	vec4 specular=texture2D(materia.specular,tex);
	specular*=pow(dot(halfVector,normal),materia.shininess);
	
	return ambient+specular.xyz;
};