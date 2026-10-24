# खाते सारांश — गणनेची तांत्रिक पडताळणी

## वापरकर्त्याने स्पष्ट केलेला अर्थ

- **एकूण हिशोब:** सुरुवातीपासून आजपर्यंतचे वाटप, बंद खाती आणि आजची सक्रिय शिल्लक. वापरकर्त्याच्या पुढील स्पष्टीकरणानुसार व्याज मात्र डिफॉल्टने चालू आर्थिक वर्षातील आहे; फक्त व्याजासाठी दिसणाऱ्या तारखा बदलता येतात. “सुरुवातीपासून आजपर्यंतचे सर्व मिळालेले व्याज” चेकबॉक्स चालू केल्यावर सर्व व्याज येते. हा बदल इतर आकड्यांवर परिणाम करत नाही.
- **कालावधी हिशोब:** निवडलेल्या दोन्ही तारखांसह त्यामधील वाटप आणि बंद व्यवहार. आधीच्या काळात दिलेले कर्ज या काळात बंद झाले तरी त्याची परतफेड व व्याज यात येते.
- आर्थिक वर्ष default कालावधी मोडच्या संपूर्ण हिशोबासाठी आणि एकूण मोडमध्ये फक्त व्याजासाठी आहे. गट/कर्जदार, व्याजाचे checkbox आणि तारीख निवडी स्वतंत्र आहेत; पुनःफेच/स्विचमुळे निवड reset होत नाही.
- ऐतिहासिक opening/closing balance गृहीत धरलेली नाही. आर्थिक वर्षाची शेवटची तारीख पुढील मार्च असली तरी आजनंतरचे व्याज व्यवहार “मिळालेले” म्हणून धरले जात नाहीत.

## डेटा आणि सूत्रे

समान shared builder स्क्रीन, आलेख, प्रिंट आणि Excelसाठी ओळी तयार करतो. Sources: authenticated tenant-scoped `/api/loans`, `/api/loan-closures`, `/api/groups`. Loans/closures/groups पूर्णपणे लोड होईपर्यंत किंवा refresh होताना आकडे व exports रोखले जातात; cached error लपवून जुना किंवा partial final report दाखवत नाही. कंपनीचे नाव आर्थिक गणनेत वापरले जात नाही.

| आकडा | आधार |
|---|---|
| एकूण कर्जसंख्या व वाटप | निवडलेल्या rangeमधील loanDate; प्रत्येक स्वतंत्र loan ID एकदा |
| बंद कर्जसंख्या | rangeमधील closureDate असलेले स्वतंत्र loan IDs; origination rangeची अट नाही |
| बंद रक्कम | rangeमधील बंद व्यवहारांचे principalPaid; null असल्यासच legacy principalAmount |
| मिळालेले व्याज | interestPaid; शून्य/manual override कायम. एकूण मोडमध्ये स्वतंत्र FY/date range (डिफॉल्ट), checkbox चालू असल्यास सुरुवात–आज. कालावधी मोडमध्ये विद्यमान कालावधी. केवळ null असल्यास calculatedInterest, नंतर interestAmount |
| एकूण मोडची सक्रिय संख्या/मुद्दल | सर्व आज चालू status असलेली, loanDate आज किंवा पूर्वीची कर्जे; selected startपासून स्वतंत्र असल्याचे स्पष्ट |
| कालावधी मोडची सक्रिय संख्या/मुद्दल | त्या काळात दिलेली व आजही चालू कर्जे. **त्या कालावधीच्या शेवटची ऐतिहासिक शिल्लक नाही**; तक्त्यासमोरील टिपेत स्पष्ट |
| वजन | rangeमधील वाटप कर्जांच्या मूळ gram weightsची अचूक बेरीज, display २ दशांश; शुद्धतेने मूळ वजन बदलत नाही |
| शुद्ध वजन | विद्यमान weight × purity/100; gold/silver classifications बदललेल्या नाहीत |
| ग्रँड टोटल | दाखवलेल्या ओळींची बेरीज; गटांमध्ये विना गट/निष्क्रिय गटांचा “विना गट / इतर” bucket |
| कर्जदार | नाव trim + case-insensitive matching; नावे normalize करून एकदाच |
| टॉप ५० | विद्यमान scoreने निवडलेल्या ५० ओळींचीच टोटल; संपूर्ण व्यवसाय म्हणून दाखवत नाही |

गट API फक्त active groups देते, loan API inactive groupsमधील loansही आणते; ते “विना गट / इतर”मध्ये येतात. Loan APIमधील विद्यमान inner joinमुळे physically missing group recordsसंबंधी कर्जे APIनेच वगळली तर client ती पुनर्प्राप्त करू शकत नाही. या कामात backend/storage/schema बदललेले नाहीत.

## Reconciliation उदाहरण

नमुना: जुन्या वर्षाचे ₹१०,००० कर्ज या काळात बंद; या काळातील वाटप ₹५,००० चालू + ₹३,००० नंतर बंद + ₹४,००० याच काळात बंद; जुन्या ₹२,०००चे कर्ज आजही चालू.

- कालावधी वाटप = ३ खाती, ₹१२,०००; बंद = २ खाती, ₹१४,०००; मिळालेले व्याज = ₹१,२००.
- या काळात दिलेले व आज चालू मुद्दल = ₹५,०००. ₹१२,००० − ₹१४,००० = −₹२,००० हे **शिल्लक नाही**.
- पूर्ण cumulative (नंतरचे बंदही धरून): वाटप ₹२४,०००, बंद मुद्दल ₹१७,०००, आजचे सक्रिय मुद्दल ₹७,०००, मिळालेले व्याज ₹१,५००.
- दुसऱ्या काळात बंद झालेल्या कर्जाचे वर्तमान status जुन्या कालावधीची ending balance काढायला पुरेसे नाही.

## जुने गुणांकन — जतन केलेली पण मर्यादा असलेली पद्धत

- टॉप-५० निवड: व्यवहार/कमाल ×४० + (वाटप+बंद मुद्दल)/कमाल ×३० + ranking interest/कमाल ×२० + (बंद खाती/वाटप खाती) ×१०. एकूण मोडचे ranking interest नेहमी मूळ संपूर्ण कालावधीचेच ठेवले आहे: व्याजाचा checkbox बदलल्याने टॉप-५० सदस्य/इतर टोटल बदलू नयेत. शेवटच्या गुणोत्तरातील populations वेगळे असल्यामुळे १००हून अधिक score शक्य आहे; हे अधिकृत performance probability नाही.
- गट/कर्जदार विश्लेषणातील smart score: सक्रिय/कमाल ×३५ + min(१००, बंद मुद्दल/वाटप ×१००) /१०० ×३० + turnover/कमाल ×२० + खाती/कमाल ×१५; सक्रिय खाती शून्य असल्यास ×०.४.
- या काळातील बंद रकमेत जुनी कर्जे असल्यामुळे बंद/वाटप “वसुली दर” समान cohortचा repayment rate नाही; विद्यमान display १००%वर cap करतो. खालील जुनी क्रमवारी या मर्यादेसह स्पष्ट इशाऱ्याने दाखवली जाते. Denominator किंवा score weights स्वतःहून बदललेले नाहीत.
- नवीन overviewमधील आलेख थेट raw रक्कम/खातेसंख्या दाखवतात; मुद्दल, व्याज व खाती एका unitमध्ये मिसळलेली नाहीत. Overlapping populationsची pie-chart partition केली नाही.

## बंद नोंदी / reopen

बंद व्यवहारांच्या APIला join नाही, त्यामुळे सामान्य fetchमध्ये प्रत्येक closure primary ID एकदाच येतो. चुकून repeated payloadमध्ये तोच ID आल्यास आता एकदाच मोजतो; वेगळे closure IDs स्वतःहून loanIdवर collapse करत नाही. वेगवेगळ्या वैध घटनांची रक्कम का वगळायची याचा निर्णय userच्या मंजुरीशिवाय घेतलेला नाही.

विद्यमान reopen backend बंद नोंदी delete करून status active करते आणि linked cash entries reverse करते. रिपोर्टकडे delete झालेल्या closureचा इतिहास नसतो. म्हणून reopenपूर्वीच्या ऐतिहासिक शिल्लक/व्याजाचे अपरिवर्तनीय पुनर्निर्माण या sourcesवर हमखास शक्य नाही. `isClosed` eligibility बदललेली नाही; जुन्या reportप्रमाणे उपलब्ध closure eventsच वापरतो.

## सिद्ध दोष व दुरुस्ती

- दोन मोड एकाच date pairवर अवलंबून होते — आता स्वतंत्र state.
- “एकूण” हा financial-year activity होता — वापरकर्त्याच्या स्पष्ट नवीन अर्थानुसार सुरुवातीपासून आजपर्यंत default.
- loading/errorचा empty-arrayशी गोंधळ, reversed/रिकाम्या dates, sourceमधील अवैध money/date — स्पष्ट guard.
- Screen/print/Excel metadata वेगवेगळी — एकच mode/date/scope/explanation context; Excelमध्ये numeric zeros व final total जतन.
- Print colgroupमध्ये प्रत्यक्ष cellsपेक्षा एक जास्त column होता — ८/९ columnsशी जुळवला; मराठी font तयार झाल्यावर print.
- print HTMLमध्ये user/company नावे text म्हणून escaped; shared print rowsची प्रत्यक्ष चाचणी.
- वापरात नसलेली transaction fetch काढली. इतर reports किंवा monetary write paths बदललेले नाहीत.

## पडताळणी

Synthetic testsमध्ये mode/view date retention, FY boundaries, same-day/inclusive dates, malformed/loading/error/empty states, all-time vs period, cross-period closures, later closures, zero/manual overrides, reopen reversal, duplicate IDs, group/customer totals आणि subset semantics समाविष्ट आहेत. प्रत्यक्ष SVG overview, print rows आणि in-memory XLSX roundtrip तपासले आहेत. वास्तविक signed-in UI/PDFच्या दृश्य पडताळणीची मर्यादा final deliveryमध्ये स्वतंत्रपणे सांगावी.
