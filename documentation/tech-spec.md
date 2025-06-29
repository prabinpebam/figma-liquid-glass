# Liquid GLass

## Construction
The Liquid glass element is constructed in the following manner.

The name of the Liquid glass element frame layer should be constrcuted in the following manner
[LG - ET10 RS25 CA5 BB1.0]
LG = Liquid glass
ET10 = Edge thickness: 10
RS25 = Refraction Strength: 25
CA5 = Chromatic abberation: 5
BB1.0 = Background blur: 1.0

This name will be used as a unique identifier and a local storage for the LG parameters.

The parameter in the following JSON represents native Figma parameters.

```json
{
    "layer name": "[LG - ET11 RS29 CA5 BB0]",
    "layer type": "frame",
    "clip content": false,
    "height": "100px",
    "width": "200px",
    "corner radius": "50px for rectangle shape, NA for ellipses and flattened shape",
    "effects": [
        {
            "Effect type": "Drop shadow",
            "Position": [
                {
                    "x": 0,
                    "y": 6
                }
            ],
            "Blur": 5,
            "Spread": 0,
            "Color": [
                {
                    "Value": "#000000",
                    "Opacity": "25%"
        
                }
            ]
        },
    ],
    "children": [
        {
            "layer name": "Highlight group",
            "layer type": "frame",
            "clip content": true,
            "height": "100% of parent",
            "width": "100% of parent",            
            "constraints": [
                {
                    "x-axis": "scale",
                    "y-axis": "scale"
                }
            ],
            "role": "Layer for all highlight effect for liquid glass should should go above user content.",
            "children": [
                {
                    "layer name": "Highlight reflection",
                    "layer type": "rectangle",
                    "height": "100% of parent",
                    "width": "100% of parent",
                    "corner radius": "always matched with main LG parent element for rectangle shape, NA for ellipses and flattened shape",
                    "stroke": [
                        {
                            "Position": "Center",
                            "Weight": 12,                            
                            "opacity": "100%",
                            "color": [
                        {
                            "color type": "Angular gradient",
                            "stops": [
                                {
                                    "Stop number" : 1,
                                    "position": "12%",
                                    "color": "#ffffff",
                                    "opacity": "100%"
                                },
                                {
                                    "Stop number" : 2,
                                    "position": "28%",
                                    "color": "#ffffff",
                                    "opacity": "0%"
                                },
                                {
                                    "Stop number" : 3,
                                    "position": "36%",
                                    "color": "#ffffff",
                                    "opacity": "0%"
                                },
                                {
                                    "Stop number" : 4,
                                    "position": "64%",
                                    "color": "#ffffff",
                                    "opacity": "100%"
                                },
                                {
                                    "Stop number" : 5,
                                    "position": "78%",
                                    "color": "#ffffff",
                                    "opacity": "0%"
                                },
                                {
                                    "Stop number" : 6,
                                    "position": "89%",
                                    "color": "#ffffff",
                                    "opacity": "0%"
                                }
                            ]
                        }
                    ]                                                    
                        }
                    ],
                    "effect": [
                        {
                            "Blur": 14
                        }
                    ],
                    "role": "Reflection effect simulated with a blurred layer with border"
                },
                {
                    "layer name": "Shape mask",
                    "layer type": "rectangle/Oval/flattened shape",
                    "corner radius": "always matched with main LG parent element for rectangle shape, NA for ellipses and flattened shape",
                    "mask layer": true,
                    "fill": "#000000",
                    "stroke": false,
                    "height": "100% of parent",
                    "width": "100% of parent",
                    "corner radius": "match with LG main parent element for rectangle shape, NA for ellipses and flattened shape",
                    "role": "This is either rectangle, ellipse or flattened shape as derived from how the LG element was created. This is always matched with the Refraction layer shape."
                }
            ]
        },
        {
            "layer name": "Content",
            "layer type": "frame",
            "height": "100% of parent",
            "width": "100% of parent",
            "clip content": false,
            "constraints": [
                {
                    "x-axis": "scale",
                    "y-axis": "scale"
                }
            ],
            "role": "Layer where for user content, can be empty."
        },
        {
            "layer name": "tint group",
            "layer type": "frame",
            "clip content": true,
            "height": "100% of parent",
            "width": "100% of parent",            
            "constraints": [
                {
                    "x-axis": "scale",
                    "y-axis": "scale"
                }
            ],
            "role": "Layer for all highlight effect for liquid glass should should go above user content.",
            "children": [
                {
                    "layer name": "Tint layer",
                    "layer type": "rectangle",
                    "height": "100% of parent",
                    "width": "100% of parent",
                    "constraints": [
                        {
                            "x-axis": "scale",
                            "y-axis": "scale"
                        }
                    ],
                    "Fill color": [
                        {
                            "value": "#ffffff",
                            "Opacity": "20%"
                        }
                    ],
                    "role": "This layer provides a tint effect which users can control."
                },
                {
                    "layer name": "Shape mask",
                    "layer type": "rectangle/Oval/flattened shape",
                    "corner radius": "always matched with main LG parent element for rectangle shape, NA for ellipses and flattened shape",
                    "mask layer": true,
                    "fill": "#000000",
                    "stroke": false,
                    "height": "100% of parent",
                    "width": "100% of parent",
                    "corner radius": "match with LG main parent element for rectangle shape, NA for ellipses and flattened shape",
                    "role": "This is either rectangle, ellipse or flattened shape as derived from how the LG element was created. This is always matched with the Refraction layer shape."
                }
            ]
        },
        {
            "layer name": "Refraction layer",
            "layer type": "rectangle",
            "height": "100% of parent",
            "width": "100% of parent",
            "corner radius": "always matched with main LG parent element for rectangle shape, NA for ellipses and flattened shape",
            "constraints": [
                {
                    "x-axis": "scale",
                    "y-axis": "scale"
                }
            ],
            "stroke": [
                {
                    "Position": "Inside",
                    "Weight": 1,                            
                    "opacity": "100%",
                    "color": [
                        {
                            "color type": "Angular gradient",
                            "stops": [
                                {
                                    "Stop number" : 1,
                                    "position": "12%",
                                    "color": "#ffffff",
                                    "opacity": "100%"
                                },
                                {
                                    "Stop number" : 2,
                                    "position": "28%",
                                    "color": "#ffffff",
                                    "opacity": "40%"
                                },
                                {
                                    "Stop number" : 3,
                                    "position": "36%",
                                    "color": "#ffffff",
                                    "opacity": "40%"
                                },
                                {
                                    "Stop number" : 4,
                                    "position": "64%",
                                    "color": "#ffffff",
                                    "opacity": "100%"
                                },
                                {
                                    "Stop number" : 5,
                                    "position": "78%",
                                    "color": "#ffffff",
                                    "opacity": "40%"
                                },
                                {
                                    "Stop number" : 6,
                                    "position": "89%",
                                    "color": "#ffffff",
                                    "opacity": "40%"
                                }
                            ]
                        }
                    ]
                }
            ],
            "effects": [                
                {
                    "Effect type": "Inner shadow",
                    "Position": [
                        {
                            "x": 10,
                            "y": 10
                        }
                    ],
                    "Blur": 10,
                    "Spread": 0,
                    "Color": [
                        {
                            "Value": "#000000",
                            "Opacity": "40%"
                
                        }
                    ]
                }
            ],
            "role": "Layer where the distorted image of refraction is applied."
        }
    ]
}
```



# Update of LG element by selection
LG element are meant to be dragged and resized as a whole at the LG element level which has the name in the format "[LG - ET10 RS25 CA5 BB1.0]"
- Selecting an LG element that's already in Figma, as qualified by the name, disables the "Create Liquid Glass" button as that fucntionality is not applicable. Instead the sliders update to display the value of the selected LG element.
- Change in corner radius, position and size of LG element layer will update strictly only and only the "Refraction layer" background image through the plugin. No other Figma parameter will be changed.
    - The corner radius of the LG element is taken from the Corner radius of parent LG element with the name "[LG - ET10 RS25 CA5 BB1.0]"
    - Every time the LG element is updated as a whole, the corner radius of the "Refraction layer" and "Highlight layer" should be made exactly the same as the LG element parent layer.
- Changing the value of the slider will immediately update the image of the "Refraction layer" in realtime as per the parameter and update the LG element layer name to reflect the new parameters. 